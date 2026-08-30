import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  correctOffer,
  correctProduct,
  mergeProducts,
  reassignListing,
} from '../src/catalog/maintenance'
import {
  createApplicationSecurityBoundary,
  requireAdminContext,
  type AdminContext,
  type SecurityEnvironment,
} from '../src/security/admin-boundary'
import { createD1TestDatabase, type D1TestDatabase } from './d1'

const fixturePath = resolve('tests/fixtures/catalog.sql')
const fixtureNow = 1_787_990_400_000
const changedAt = fixtureNow + 100_000

const createActor = async () => {
  let actor: AdminContext | undefined
  const boundary = createApplicationSecurityBoundary(
    (request) => {
      actor = requireAdminContext(request)
      return new Response('ok')
    },
    { generateRequestId: () => 'catalog-maintenance-test' },
  )
  const environment: SecurityEnvironment = {
    APP_ENV: 'local',
    ACCESS_TEAM_DOMAIN: 'local.invalid',
    ACCESS_AUD: 'local-unused',
    ACCESS_OPERATOR_SUBJECT: 'local-operator',
    TRUSTED_ORIGIN: 'http://localhost:3000',
  }
  await boundary(
    new Request('http://localhost:3000/admin/catalog', {
      headers: { 'X-Babyboel-Local-Actor': 'local-operator' },
    }),
    environment,
  )
  if (!actor) throw new Error('Unable to establish Admin context')
  return actor
}

describe('catalog maintenance D1 boundary', () => {
  let database: D1TestDatabase
  let actor: AdminContext

  beforeAll(async () => {
    database = await createD1TestDatabase()
    await database.executeFile(fixturePath)
    actor = await createActor()
  }, 30_000)

  afterAll(async () => {
    await database.close()
  })

  it('corrects an Offer with exact operands, audit, and stale-write rejection', async () => {
    await expect(
      correctOffer(database.binding, {
        offerId: '018f47a0-0000-7000-8000-000000000007',
        expectedUpdatedAt: fixtureNow,
        changedAt,
        payableAmountMinor: 1_599,
        requiredPackageCount: 1,
        eligibility: 'universal',
        conditionText: null,
        availability: 'available',
        confirmedAt: changedAt,
        declaredExpiresAt: null,
        actor,
        auditId: '018f47a0-0000-7000-8000-000000000040',
        reason: 'Correct a verified source parsing error',
        evidenceReference: {
          observationId: '018f47a0-0000-7000-8000-00000000000a',
        },
      }),
    ).resolves.toEqual({ status: 'updated', version: changedAt })

    expect(
      await database.execute<{
        amount: number
        numerator: number
        denominator: number
      }>(`
        SELECT payable_amount_minor AS amount,
          unit_price_numerator AS numerator,
          unit_price_denominator AS denominator
        FROM offers
        WHERE id = '018f47a0-0000-7000-8000-000000000007'
      `),
    ).toEqual([{ amount: 1599, numerator: 1599, denominator: 80 }])

    await expect(
      correctOffer(database.binding, {
        offerId: '018f47a0-0000-7000-8000-000000000007',
        expectedUpdatedAt: fixtureNow,
        changedAt: changedAt + 1,
        payableAmountMinor: 999,
        requiredPackageCount: 1,
        eligibility: 'universal',
        conditionText: null,
        availability: 'available',
        confirmedAt: changedAt + 1,
        declaredExpiresAt: null,
        actor,
        auditId: '018f47a0-0000-7000-8000-000000000041',
        reason: 'Stale correction must not apply',
        evidenceReference: {
          observationId: '018f47a0-0000-7000-8000-00000000000a',
        },
      }),
    ).resolves.toEqual({ status: 'conflict', version: changedAt })

    await expect(
      correctOffer(database.binding, {
        offerId: '018f47a0-0000-7000-8000-000000000007',
        expectedUpdatedAt: changedAt,
        changedAt: changedAt + 2,
        payableAmountMinor: 1_499,
        requiredPackageCount: 1,
        eligibility: 'universal',
        conditionText: null,
        availability: 'available',
        confirmedAt: changedAt + 2,
        declaredExpiresAt: null,
        actor,
        auditId: '018f47a0-0000-7000-8000-000000000040',
        reason: 'A failed audit must roll back the state correction',
        evidenceReference: {
          observationId: '018f47a0-0000-7000-8000-00000000000a',
        },
      }),
    ).rejects.toThrow(/UNIQUE constraint failed/)

    const [rolledBack] = await database.execute<{
      amount: number
      version: number
    }>(`
      SELECT payable_amount_minor AS amount, updated_at AS version
      FROM offers
      WHERE id = '018f47a0-0000-7000-8000-000000000007'
    `)
    expect(rolledBack).toEqual({ amount: 1599, version: changedAt })

    const [{ count }] = await database.execute<{ count: number }>(`
      SELECT COUNT(*) AS count
      FROM audit_log
      WHERE action = 'offer.correct'
    `)
    expect(count).toBe(1)
  }, 60_000)

  it('reassigns a Listing and non-destructively merges a duplicate Product', async () => {
    await database.execute(`
      INSERT INTO products (
        id, brand_id, category_code, line, variant, normalized_size_code,
        identity_key, slug, lifecycle, created_at, updated_at
      ) VALUES (
        '018f47a0-0000-7000-8000-000000000042',
        '018f47a0-0000-7000-8000-000000000003',
        'disposable_diaper', 'Original', 'Regular', '4+',
        'fixture-brand|disposable_diaper|original-typo|regular|4+',
        'fixture-brand-original-typo-4-plus', 'active', ${fixtureNow},
        ${fixtureNow}
      );
      INSERT INTO packages (
        id, product_id, unit_count, inner_pack_count, units_per_inner_pack,
        gtin, lifecycle, created_at, updated_at
      ) VALUES (
        '018f47a0-0000-7000-8000-000000000043',
        '018f47a0-0000-7000-8000-000000000042',
        40, 2, 20, '08712345678910', 'active', ${fixtureNow}, ${fixtureNow}
      )
    `)

    await expect(
      reassignListing(database.binding, {
        listingId: '018f47a0-0000-7000-8000-000000000006',
        packageId: '018f47a0-0000-7000-8000-000000000043',
        expectedUpdatedAt: fixtureNow,
        changedAt,
        actor,
        auditId: '018f47a0-0000-7000-8000-000000000044',
        reason: 'Associate the Listing with the evidence-backed Package',
        evidenceReference: {
          observationId: '018f47a0-0000-7000-8000-00000000000a',
        },
      }),
    ).resolves.toEqual({ status: 'updated', version: changedAt })

    expect(
      await database.execute<{ totalUnits: number; denominator: number }>(`
        SELECT total_units AS totalUnits,
          unit_price_denominator AS denominator
        FROM offers
        WHERE id = '018f47a0-0000-7000-8000-000000000007'
      `),
    ).toEqual([{ totalUnits: 40, denominator: 40 }])

    await expect(
      mergeProducts(database.binding, {
        survivorProductId: '018f47a0-0000-7000-8000-000000000004',
        duplicateProductId: '018f47a0-0000-7000-8000-000000000042',
        expectedSurvivorUpdatedAt: fixtureNow,
        expectedDuplicateUpdatedAt: fixtureNow,
        changedAt: changedAt + 1,
        actor,
        auditId: '018f47a0-0000-7000-8000-000000000045',
        reason: 'Merge a confirmed duplicate Product',
        evidenceReference: {
          observationId: '018f47a0-0000-7000-8000-00000000000a',
        },
        confirmedSameProduct: true,
      }),
    ).resolves.toEqual({
      status: 'merged',
      version: changedAt + 1,
      movedPackageCount: 1,
    })

    expect(
      await database.execute<{
        lifecycle: string
        mergedInto: string
        packageProductId: string
      }>(`
        SELECT products.lifecycle,
          products.merged_into_product_id AS mergedInto,
          packages.product_id AS packageProductId
        FROM products
        JOIN packages
          ON packages.id = '018f47a0-0000-7000-8000-000000000043'
        WHERE products.id = '018f47a0-0000-7000-8000-000000000042'
      `),
    ).toEqual([
      {
        lifecycle: 'inactive',
        mergedInto: '018f47a0-0000-7000-8000-000000000004',
        packageProductId: '018f47a0-0000-7000-8000-000000000004',
      },
    ])

    await expect(
      correctProduct(database.binding, {
        productId: '018f47a0-0000-7000-8000-000000000042',
        expectedUpdatedAt: changedAt + 1,
        changedAt: changedAt + 2,
        categoryCode: 'disposable_diaper',
        line: 'Original typo',
        variant: 'Regular',
        normalizedSizeCode: '4+',
        slug: 'fixture-brand-original-typo-4-plus',
        lifecycle: 'active',
        successorProductId: null,
        mergedIntoProductId: null,
        restorePackageIds: ['018f47a0-0000-7000-8000-000000000043'],
        actor,
        auditId: '018f47a0-0000-7000-8000-000000000046',
        reason: 'Correct the mistaken merge forward without deleting history',
        evidenceReference: {
          observationId: '018f47a0-0000-7000-8000-00000000000a',
        },
      }),
    ).resolves.toEqual({ status: 'updated', version: changedAt + 2 })

    expect(
      await database.execute<{
        lifecycle: string
        mergedInto: string | null
        packageProductId: string
      }>(`
        SELECT products.lifecycle, products.merged_into_product_id AS mergedInto,
          packages.product_id AS packageProductId
        FROM products
        JOIN packages
          ON packages.id = '018f47a0-0000-7000-8000-000000000043'
        WHERE products.id = '018f47a0-0000-7000-8000-000000000042'
      `),
    ).toEqual([
      {
        lifecycle: 'active',
        mergedInto: null,
        packageProductId: '018f47a0-0000-7000-8000-000000000042',
      },
    ])
  }, 60_000)
})
