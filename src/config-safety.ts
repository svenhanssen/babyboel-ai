import { z } from 'zod'

const bindingSchema = z.object({
  binding: z.string(),
  database_name: z.string().optional(),
  bucket_name: z.string().optional(),
})

const securityVariablesSchema = z.object({
  ACCESS_TEAM_DOMAIN: z
    .string()
    .min(1)
    .refine(
      (value) =>
        !value.includes('://') && !value.includes('/') && !value.includes('@'),
      'Access team domain must be a hostname',
    ),
  ACCESS_AUD: z.string().min(1),
  ACCESS_OPERATOR_SUBJECT: z.string().min(1),
  TRUSTED_ORIGIN: z
    .url()
    .refine((value) => new URL(value).protocol === 'https:', {
      message: 'Deployed trusted origin must use HTTPS',
    })
    .refine((value) => new URL(value).origin === value, {
      message: 'Trusted origin cannot include a path',
    }),
})

const deploymentSchema = z.object({
  vars: z
    .object({
      APP_ENV: z.enum(['preview', 'production']),
      ACQUISITION_MODE: z.enum(['disabled', 'fixture', 'live']),
    })
    .and(securityVariablesSchema),
  d1_databases: z.array(bindingSchema),
  r2_buckets: z.array(bindingSchema),
})

const configSchema = z.object({
  env: z.object({
    preview: deploymentSchema,
    production: deploymentSchema,
  }),
})

export function validateDeploymentConfig(input: unknown): void {
  const config = configSchema.parse(input)
  const { preview, production } = config.env

  if (preview.vars.ACQUISITION_MODE !== 'fixture') {
    throw new Error('Preview acquisition must be fixture-only')
  }

  const previewDatabase = preview.d1_databases.find(
    ({ binding }) => binding === 'DB',
  )
  const productionDatabase = production.d1_databases.find(
    ({ binding }) => binding === 'DB',
  )
  const previewEvidence = preview.r2_buckets.find(
    ({ binding }) => binding === 'EVIDENCE',
  )
  const productionEvidence = production.r2_buckets.find(
    ({ binding }) => binding === 'EVIDENCE',
  )

  if (!previewDatabase || !productionDatabase) {
    throw new Error('Preview and production must each declare DB')
  }

  if (!previewEvidence || !productionEvidence) {
    throw new Error('Preview and production must each declare EVIDENCE')
  }

  if (previewDatabase.database_name === productionDatabase.database_name) {
    throw new Error('Preview cannot use the production D1 database')
  }

  if (previewEvidence.bucket_name === productionEvidence.bucket_name) {
    throw new Error('Preview cannot use the production R2 bucket')
  }

  if (preview.vars.ACCESS_AUD === production.vars.ACCESS_AUD) {
    throw new Error('Preview cannot use the production Access audience')
  }

  if (preview.vars.TRUSTED_ORIGIN === production.vars.TRUSTED_ORIGIN) {
    throw new Error('Preview cannot use the production trusted origin')
  }
}
