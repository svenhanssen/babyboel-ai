import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  getReviewCase,
  listReviewCases,
  resolveReviewCase,
  searchCatalog,
} from '../src/catalog/admin'
import { formatAdminDateTime } from '../src/admin/format'
import { listCurrentProductOffers } from '../src/catalog/service'
import {
  createApplicationSecurityBoundary,
  requireAdminContext,
  type AdminContext,
  type SecurityEnvironment,
} from '../src/security/admin-boundary'
import { createD1TestDatabase, type D1TestDatabase } from './d1'

const fixturePath = resolve('tests/fixtures/catalog.sql')
const fixtureNow = 1_787_990_400_000

const createActor = async () => {
  let actor: AdminContext | undefined
  const boundary = createApplicationSecurityBoundary(
    (request) => {
      actor = requireAdminContext(request)
      return new Response('ok')
    },
    { generateRequestId: () => 'catalog-admin-test' },
  )
  const environment: SecurityEnvironment = {
    APP_ENV: 'local',
    ACCESS_TEAM_DOMAIN: 'local.invalid',
    ACCESS_AUD: 'local-unused',
    ACCESS_OPERATOR_SUBJECT: 'local-operator',
    TRUSTED_ORIGIN: 'http://localhost:3000',
  }
  await boundary(
    new Request('http://localhost:3000/admin/reviews', {
      headers: { 'X-Babyboel-Local-Actor': 'local-operator' },
    }),
    environment,
  )
  if (!actor) throw new Error('Unable to establish Admin context')
  return actor
}

describe('Reviews and Catalog Admin service', () => {
  let database: D1TestDatabase
  let actor: AdminContext

  beforeEach(async () => {
    database = await createD1TestDatabase()
    await database.executeFile(fixturePath)
    actor = await createActor()
  }, 30_000)

  afterEach(async () => {
    await database.close()
  })

  it('formats Admin timestamps identically during SSR and hydration', () => {
    expect(formatAdminDateTime(fixtureNow)).toBe('29 Aug 2026, 10:00')
  })

  it('lists publication-blocking Reviews first and returns bounded sanitized detail', async () => {
    await database.execute(`
      INSERT INTO review_cases (
        id, retailer_id, listing_id, latest_observation_id, uncertainty_type,
        status, blocks_publication, case_version, occurrence_count, notes,
        opened_at, updated_at
      ) VALUES (
        '018f47a0-0000-7000-8000-000000000050',
        '018f47a0-0000-7000-8000-000000000001',
        '018f47a0-0000-7000-8000-000000000006',
        '018f47a0-0000-7000-8000-00000000000a', 'availability_question',
        'open', 0, 1, 1, 'Non-blocking fixture',
        ${fixtureNow - 10_000}, ${fixtureNow}
      )
    `)

    const queue = await listReviewCases(database.binding, { status: 'open' })
    expect(queue.cases.map((review) => review.id)).toEqual([
      '018f47a0-0000-7000-8000-00000000000b',
      '018f47a0-0000-7000-8000-000000000050',
    ])
    expect(queue.counts).toEqual({ openCount: 2, closedCount: 0 })

    const detail = await getReviewCase(database.binding, {
      caseId: '018f47a0-0000-7000-8000-00000000000b',
    })
    expect(detail).toMatchObject({
      retailerName: 'Fixture Retailer',
      retailerSku: 'SKU-4PLUS-80',
      evidenceAvailable: true,
      candidates: [
        {
          packageId: '018f47a0-0000-7000-8000-000000000005',
        },
      ],
    })
    expect(detail?.rawFacts).toEqual({ price: '19.99', quantity: 80 })
    expect(JSON.stringify(detail)).not.toContain('r2_key')
  }, 30_000)

  it('resolves an uncertain observation into a current Offer with one audited transaction', async () => {
    await expect(
      listCurrentProductOffers(database.binding, {
        productId: '018f47a0-0000-7000-8000-000000000004',
        now: fixtureNow,
      }),
    ).resolves.toMatchObject({ primary: [], restricted: [] })

    await expect(
      resolveReviewCase(database.binding, {
        caseId: '018f47a0-0000-7000-8000-00000000000b',
        expectedCaseVersion: 1,
        expectedListingUpdatedAt: fixtureNow,
        changedAt: fixtureNow + 1,
        auditId: '018f47a0-0000-7000-8000-000000000051',
        action: 'associate',
        packageId: '018f47a0-0000-7000-8000-000000000005',
        reason: 'Approve the exact verified Package association',
        actor,
      }),
    ).resolves.toEqual({
      status: 'resolved',
      outcome: 'associated',
      caseVersion: 2,
    })

    const offers = await listCurrentProductOffers(database.binding, {
      productId: '018f47a0-0000-7000-8000-000000000004',
      now: fixtureNow,
    })
    expect(offers.primary).toHaveLength(1)
    expect(offers.primary[0]).toMatchObject({
      listingId: '018f47a0-0000-7000-8000-000000000006',
      payableAmountMinor: 1999,
    })
    expect(
      await database.execute(`
        SELECT review_cases.status, review_cases.closure_outcome AS outcome,
          audit_log.actor, audit_log.action, audit_log.reason
        FROM review_cases
        JOIN audit_log ON audit_log.target_id = review_cases.id
        WHERE audit_log.id = '018f47a0-0000-7000-8000-000000000051'
      `),
    ).toEqual([
      {
        status: 'closed',
        outcome: 'associated',
        actor: 'local-operator',
        action: 'review.associate',
        reason: 'Approve the exact verified Package association',
      },
    ])
  }, 30_000)

  it('rejects stale work and rolls the state back when its audit cannot commit', async () => {
    await expect(
      resolveReviewCase(database.binding, {
        caseId: '018f47a0-0000-7000-8000-00000000000b',
        expectedCaseVersion: 9,
        expectedListingUpdatedAt: fixtureNow,
        changedAt: fixtureNow + 1,
        auditId: '018f47a0-0000-7000-8000-000000000052',
        action: 'false_alarm',
        reason: 'Reject this deliberately stale operator decision',
        actor,
      }),
    ).resolves.toMatchObject({ status: 'conflict', caseVersion: 1 })

    await expect(
      resolveReviewCase(database.binding, {
        caseId: '018f47a0-0000-7000-8000-00000000000b',
        expectedCaseVersion: 1,
        expectedListingUpdatedAt: fixtureNow,
        changedAt: fixtureNow + 2,
        auditId: '018f47a0-0000-7000-8000-00000000000c',
        action: 'out_of_scope',
        reason: 'This audit identifier collision must roll everything back',
        actor,
      }),
    ).rejects.toThrow(/UNIQUE constraint failed/)

    expect(
      await database.execute(`
        SELECT review_cases.status, review_cases.case_version AS caseVersion,
          listings.match_status AS matchStatus, listings.availability
        FROM review_cases JOIN listings ON listings.id = review_cases.listing_id
        WHERE review_cases.id = '018f47a0-0000-7000-8000-00000000000b'
      `),
    ).toEqual([
      {
        status: 'open',
        caseVersion: 1,
        matchStatus: 'matched',
        availability: 'available',
      },
    ])
  }, 30_000)

  it('searches Product, Package, and Listing terminology literally', async () => {
    const byName = await searchCatalog(database.binding, {
      search: 'Fixture Brand',
    })
    expect(byName.products).toHaveLength(1)
    expect(byName.packages).toHaveLength(1)
    expect(byName.listings).toHaveLength(1)

    const byGtin = await searchCatalog(database.binding, {
      search: '08712345678903',
      entityType: 'package',
    })
    expect(byGtin).toMatchObject({
      products: [],
      listings: [],
      packages: [{ identifier: '08712345678903', lifecycle: 'active' }],
    })
  }, 30_000)
})
