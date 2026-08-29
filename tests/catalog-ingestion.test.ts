import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  applyListingMatchDecision,
  recordSourceObservation,
} from '../src/catalog/ingestion'
import { createD1TestDatabase, type D1TestDatabase } from './d1'

const fixturePath = resolve('tests/fixtures/catalog.sql')
const now = 1_787_990_500_000
const observation = {
  id: '018f47a0-0000-7000-8000-000000000030',
  retailerSourceId: '018f47a0-0000-7000-8000-000000000002',
  retailerRunId: '018f47a0-0000-7000-8000-000000000008',
  sourceListingKey: 'SKU-4PLUS-80',
  sourceOfferKey: 'changed',
  observedAt: now,
  retrievedAt: now,
  sourceUrl: 'https://retailer.example/fixture-brand-4-plus',
  rawFacts: { title: 'Contradictory source title' },
  normalizedFacts: { categoryCode: 'diaper_pants' },
  extractionMethod: 'api' as const,
  sanitizedExcerpt: 'Contradictory source title',
  issueCodes: ['identity_conflict'],
  affectedFields: ['category'],
  outcome: 'success' as const,
  responseIntegrityHash: 'sha256:changed-response',
  sanitizedContentHash: 'sha256:changed-sanitized',
  observationFormat: 1,
  adapterIdentifier: 'fixture-adapter@1',
}

describe('catalog ingestion D1 boundary', () => {
  let database: D1TestDatabase

  beforeAll(async () => {
    database = await createD1TestDatabase()
    database.executeFile(fixturePath)
  }, 30_000)

  afterAll(async () => {
    await database.close()
  })

  it('records the same Source Observation idempotently', async () => {
    await expect(
      recordSourceObservation(database.binding, observation),
    ).resolves.toEqual({ id: observation.id, inserted: true })

    await expect(
      recordSourceObservation(database.binding, {
        ...observation,
        id: '018f47a0-0000-7000-8000-000000000031',
      }),
    ).resolves.toEqual({ id: observation.id, inserted: false })

    const [{ count }] = database.execute<{ count: number }>(`
      SELECT COUNT(*) AS count
      FROM source_observations
      WHERE response_integrity_hash = 'sha256:changed-response'
    `)
    expect(count).toBe(1)
  }, 20_000)

  it('suppresses a contradictory Listing and opens one logical Review case', async () => {
    const result = await applyListingMatchDecision(database.binding, {
      listingId: '018f47a0-0000-7000-8000-000000000006',
      observationId: observation.id,
      reviewCaseId: '018f47a0-0000-7000-8000-000000000032',
      expectedUpdatedAt: 1_787_990_400_000,
      decidedAt: now,
      fingerprint: 'fingerprint:changed',
      decision: {
        kind: 'review',
        uncertaintyType: 'contradiction',
        reasons: ['categoryCode'],
      },
      blockAutomaticReuse: true,
    })

    expect(result).toEqual({ status: 'review', version: now })
    expect(
      database.execute<{
        matchStatus: string
        packageId: string | null
        availability: string
        blocked: number
      }>(`
        SELECT match_status AS matchStatus, package_id AS packageId,
          availability, automatic_reuse_blocked AS blocked
        FROM listings
        WHERE id = '018f47a0-0000-7000-8000-000000000006'
      `),
    ).toEqual([
      {
        matchStatus: 'review',
        packageId: null,
        availability: 'unknown',
        blocked: 1,
      },
    ])

    const [review] = database.execute<{
      status: string
      occurrenceCount: number
      version: number
    }>(`
      SELECT status, occurrence_count AS occurrenceCount,
        case_version AS version
      FROM review_cases
      WHERE listing_id = '018f47a0-0000-7000-8000-000000000006'
        AND uncertainty_type = 'contradiction'
    `)
    expect(review).toEqual({
      status: 'open',
      occurrenceCount: 1,
      version: 1,
    })
  }, 20_000)

  it('does not repeat state changes for the same supporting Observation', async () => {
    await expect(
      applyListingMatchDecision(database.binding, {
        listingId: '018f47a0-0000-7000-8000-000000000006',
        observationId: observation.id,
        reviewCaseId: '018f47a0-0000-7000-8000-000000000033',
        expectedUpdatedAt: now,
        decidedAt: now + 1,
        fingerprint: 'fingerprint:changed',
        decision: {
          kind: 'review',
          uncertaintyType: 'contradiction',
          reasons: ['categoryCode'],
        },
        blockAutomaticReuse: true,
      }),
    ).resolves.toEqual({ status: 'unchanged', version: now })

    const [{ occurrenceCount }] = database.execute<{
      occurrenceCount: number
    }>(`
      SELECT occurrence_count AS occurrenceCount
      FROM review_cases
      WHERE listing_id = '018f47a0-0000-7000-8000-000000000006'
        AND uncertainty_type = 'contradiction'
    `)
    expect(occurrenceCount).toBe(1)
  }, 20_000)
})
