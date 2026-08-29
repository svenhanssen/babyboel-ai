import { describe, expect, it } from 'vitest'

import { validateDeploymentConfig } from '../src/config-safety'
import { parseEnvironment } from '../src/environment'

describe('environment guards', () => {
  it.each(['local', 'preview'] as const)(
    'allows fixture acquisition in %s',
    (APP_ENV) => {
      expect(
        parseEnvironment({ APP_ENV, ACQUISITION_MODE: 'fixture' }),
      ).toEqual({ APP_ENV, ACQUISITION_MODE: 'fixture' })
    },
  )

  it.each(['disabled', 'live'] as const)(
    'rejects %s acquisition in preview',
    (ACQUISITION_MODE) => {
      expect(() =>
        parseEnvironment({ APP_ENV: 'preview', ACQUISITION_MODE }),
      ).toThrow('preview must use fixture acquisition')
    },
  )

  it('keeps production acquisition disabled by default', () => {
    expect(
      parseEnvironment({
        APP_ENV: 'production',
        ACQUISITION_MODE: 'disabled',
      }),
    ).toEqual({
      APP_ENV: 'production',
      ACQUISITION_MODE: 'disabled',
    })
  })
})

describe('deployment configuration guards', () => {
  const safeConfig = {
    env: {
      preview: {
        vars: {
          APP_ENV: 'preview',
          ACQUISITION_MODE: 'fixture',
          ACCESS_TEAM_DOMAIN: 'babyboel.cloudflareaccess.com',
          ACCESS_AUD: 'preview-audience',
          ACCESS_OPERATOR_SUBJECT: 'github|operator',
          TRUSTED_ORIGIN: 'https://preview.babyboel.example',
        },
        d1_databases: [{ binding: 'DB', database_name: 'babyboel-preview' }],
        r2_buckets: [
          { binding: 'EVIDENCE', bucket_name: 'babyboel-evidence-preview' },
        ],
      },
      production: {
        vars: {
          APP_ENV: 'production',
          ACQUISITION_MODE: 'disabled',
          ACCESS_TEAM_DOMAIN: 'babyboel.cloudflareaccess.com',
          ACCESS_AUD: 'production-audience',
          ACCESS_OPERATOR_SUBJECT: 'github|operator',
          TRUSTED_ORIGIN: 'https://babyboel.example',
        },
        d1_databases: [{ binding: 'DB', database_name: 'babyboel-production' }],
        r2_buckets: [
          { binding: 'EVIDENCE', bucket_name: 'babyboel-evidence-production' },
        ],
      },
    },
  }

  it('accepts isolated fixture-only previews', () => {
    expect(() => validateDeploymentConfig(safeConfig)).not.toThrow()
  })

  it('rejects live retailer acquisition in previews', () => {
    expect(() =>
      validateDeploymentConfig({
        ...safeConfig,
        env: {
          ...safeConfig.env,
          preview: {
            ...safeConfig.env.preview,
            vars: {
              ...safeConfig.env.preview.vars,
              ACQUISITION_MODE: 'live',
            },
          },
        },
      }),
    ).toThrow('Preview acquisition must be fixture-only')
  })

  it('rejects a preview bound to the production database', () => {
    expect(() =>
      validateDeploymentConfig({
        ...safeConfig,
        env: {
          ...safeConfig.env,
          preview: {
            ...safeConfig.env.preview,
            d1_databases: safeConfig.env.production.d1_databases,
          },
        },
      }),
    ).toThrow('Preview cannot use the production D1 database')
  })

  it('rejects a deployed trusted origin that is not HTTPS', () => {
    expect(() =>
      validateDeploymentConfig({
        ...safeConfig,
        env: {
          ...safeConfig.env,
          production: {
            ...safeConfig.env.production,
            vars: {
              ...safeConfig.env.production.vars,
              TRUSTED_ORIGIN: 'http://babyboel.example',
            },
          },
        },
      }),
    ).toThrow('Deployed trusted origin must use HTTPS')
  })

  it('keeps preview and production Access audiences isolated', () => {
    expect(() =>
      validateDeploymentConfig({
        ...safeConfig,
        env: {
          ...safeConfig.env,
          preview: {
            ...safeConfig.env.preview,
            vars: {
              ...safeConfig.env.preview.vars,
              ACCESS_AUD: safeConfig.env.production.vars.ACCESS_AUD,
            },
          },
        },
      }),
    ).toThrow('Preview cannot use the production Access audience')
  })
})
