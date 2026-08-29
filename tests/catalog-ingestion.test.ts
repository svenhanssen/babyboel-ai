import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ingestValidatedOfferObservation,
  matchObservedListing,
  quarantineOfferObservation,
  recordIdentityObservation,
} from '../src/catalog/ingestion'
import { createD1TestDatabase, type D1TestDatabase } from './d1'

const fixturePath = resolve('tests/fixtures/catalog.sql')
const now = 1_787_990_500_000
const offerObservedAt = now + 10
const matchDecidedAt = now + 20
const observation = {
  id: '018f47a0-0000-7000-8000-000000000030',
  retailerSourceId: '018f47a0-0000-7000-8000-000000000002',
  retailerRunId: '018f47a0-0000-7000-8000-000000000008',
  sourceListingKey: 'SKU-4PLUS-80',
  sourceOfferKey: 'identity',
  observedAt: now,
  retrievedAt: now,
  sourceUrl: 'https://retailer.example/fixture-brand-4-plus',
  rawFacts: { title: 'Contradictory source title' },
  normalizedFacts: {
    brand: 'Fixture Brand',
    categoryCode: 'diaper_pants',
    normalizedSizeCode: '4+',
    line: 'Original',
    variant: 'Regular',
    gtin: '08712345678903',
    unitCount: 80,
    innerPackCount: 2,
    unitsPerInnerPack: 40,
  },
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
      recordIdentityObservation(database.binding, observation),
    ).resolves.toEqual({ id: observation.id, inserted: true })

    await expect(
      recordIdentityObservation(database.binding, {
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

  it('turns a validated Offer observation into linked current state', async () => {
    await expect(
      ingestValidatedOfferObservation(database.binding, {
        ...observation,
        id: '018f47a0-0000-7000-8000-000000000034',
        sourceOfferKey: 'single',
        observedAt: offerObservedAt,
        retrievedAt: offerObservedAt,
        responseIntegrityHash: 'sha256:offer-update',
        issueCodes: [],
        normalizedFacts: {
          payableAmountMinor: 1_799,
          totalUnits: 160,
          requiredPackageCount: 2,
          eligibility: 'universal',
          availability: 'available',
        },
        listingId: '018f47a0-0000-7000-8000-000000000006',
        offerId: '018f47a0-0000-7000-8000-000000000007',
        payableAmountMinor: 1_799,
        requiredPackageCount: 2,
        eligibility: 'universal',
        conditionText: '2 verpakkingen',
        availability: 'available',
        declaredExpiresAt: null,
        outboundDestination: 'https://retailer.example/fixture-brand-4-plus',
      }),
    ).resolves.toEqual({
      status: 'updated',
      offerId: '018f47a0-0000-7000-8000-000000000007',
    })

    expect(
      database.execute<{
        amount: number
        totalUnits: number
        observationId: string
      }>(`
        SELECT payable_amount_minor AS amount, total_units AS totalUnits,
          latest_observation_id AS observationId
        FROM offers
        WHERE id = '018f47a0-0000-7000-8000-000000000007'
      `),
    ).toEqual([
      {
        amount: 1799,
        totalUnits: 160,
        observationId: '018f47a0-0000-7000-8000-000000000034',
      },
    ])
  }, 20_000)

  it('requires clean retained Offer evidence on a non-identity lane', async () => {
    const validInput = {
      ...observation,
      id: '018f47a0-0000-7000-8000-000000000037',
      sourceOfferKey: 'single',
      observedAt: offerObservedAt + 1,
      retrievedAt: offerObservedAt + 1,
      outcome: 'success' as const,
      issueCodes: [],
      responseIntegrityHash: 'sha256:validation-only',
      listingId: '018f47a0-0000-7000-8000-000000000006',
      offerId: '018f47a0-0000-7000-8000-000000000007',
      payableAmountMinor: 1_799,
      requiredPackageCount: 2,
      eligibility: 'universal' as const,
      conditionText: '2 verpakkingen',
      availability: 'available' as const,
      declaredExpiresAt: null,
      outboundDestination: 'https://retailer.example/fixture-brand-4-plus',
    }

    await expect(
      ingestValidatedOfferObservation(database.binding, {
        ...validInput,
        outcome: 'invalid',
      }),
    ).rejects.toThrow('OBSERVATION_REQUIRES_REVIEW')
    await expect(
      ingestValidatedOfferObservation(database.binding, {
        ...validInput,
        issueCodes: ['price_conflict'],
      }),
    ).rejects.toThrow('OBSERVATION_REQUIRES_REVIEW')
    await expect(
      ingestValidatedOfferObservation(database.binding, {
        ...validInput,
        sourceOfferKey: 'identity',
      }),
    ).rejects.toThrow('OFFER_OBSERVATION_LANE_REQUIRED')
    await expect(
      ingestValidatedOfferObservation(database.binding, {
        ...validInput,
        outboundDestination: 'https://retailer.example/unrelated',
      }),
    ).rejects.toThrow('OUTBOUND_EVIDENCE_MISMATCH')
  })

  it('retains contradictory price evidence and quarantines the Offer into Review', async () => {
    await expect(
      quarantineOfferObservation(database.binding, {
        ...observation,
        id: '018f47a0-0000-7000-8000-000000000035',
        sourceOfferKey: 'single',
        observedAt: offerObservedAt + 1,
        retrievedAt: offerObservedAt + 1,
        normalizedFacts: {},
        outcome: 'invalid',
        responseIntegrityHash: 'sha256:price-conflict',
        issueCodes: ['price_conflict'],
        affectedFields: ['price'],
        listingId: '018f47a0-0000-7000-8000-000000000006',
        offerId: '018f47a0-0000-7000-8000-000000000007',
        reviewCaseId: '018f47a0-0000-7000-8000-000000000036',
        uncertaintyType: 'price_conflict',
      }),
    ).resolves.toEqual({
      status: 'review',
      observationId: '018f47a0-0000-7000-8000-000000000035',
    })

    expect(
      database.execute<{ availability: string; reviews: number }>(`
        SELECT offers.availability,
          (
            SELECT COUNT(*) FROM review_cases
            WHERE listing_id = listings.id
              AND uncertainty_type = 'price_conflict'
              AND status = 'open'
          ) AS reviews
        FROM offers
        JOIN listings ON listings.id = offers.listing_id
        WHERE offers.id = '018f47a0-0000-7000-8000-000000000007'
      `),
    ).toEqual([{ availability: 'unknown', reviews: 1 }])
  }, 20_000)

  it('suppresses a contradictory Listing and opens one logical Review case', async () => {
    const result = await matchObservedListing(database.binding, {
      listingId: '018f47a0-0000-7000-8000-000000000006',
      observationId: observation.id,
      reviewCaseId: '018f47a0-0000-7000-8000-000000000032',
      expectedUpdatedAt: offerObservedAt,
      decidedAt: matchDecidedAt,
      blockAutomaticReuse: true,
    })

    expect(result).toEqual({ status: 'review', version: matchDecidedAt })
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
      matchObservedListing(database.binding, {
        listingId: '018f47a0-0000-7000-8000-000000000006',
        observationId: observation.id,
        reviewCaseId: '018f47a0-0000-7000-8000-000000000033',
        expectedUpdatedAt: matchDecidedAt,
        decidedAt: matchDecidedAt + 1,
        blockAutomaticReuse: true,
      }),
    ).resolves.toEqual({ status: 'unchanged', version: matchDecidedAt })

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
