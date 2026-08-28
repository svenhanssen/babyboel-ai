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
        vars: { APP_ENV: 'preview', ACQUISITION_MODE: 'fixture' },
        d1_databases: [{ binding: 'DB', database_name: 'babyboel-preview' }],
        r2_buckets: [
          { binding: 'EVIDENCE', bucket_name: 'babyboel-evidence-preview' },
        ],
      },
      production: {
        vars: { APP_ENV: 'production', ACQUISITION_MODE: 'disabled' },
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
            vars: { APP_ENV: 'preview', ACQUISITION_MODE: 'live' },
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
})
