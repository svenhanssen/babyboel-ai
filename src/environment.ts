import { z } from 'zod'

const environmentSchema = z
  .object({
    APP_ENV: z.enum(['local', 'preview', 'production']),
    ACQUISITION_MODE: z.enum(['disabled', 'fixture', 'live']),
  })
  .superRefine((environment, context) => {
    if (
      environment.APP_ENV !== 'production' &&
      environment.ACQUISITION_MODE !== 'fixture'
    ) {
      context.addIssue({
        code: 'custom',
        message: `${environment.APP_ENV} must use fixture acquisition`,
        path: ['ACQUISITION_MODE'],
      })
    }
  })

export type AppEnvironment = z.infer<typeof environmentSchema>

export function parseEnvironment(input: {
  APP_ENV: string
  ACQUISITION_MODE: string
}): AppEnvironment {
  return environmentSchema.parse(input)
}
