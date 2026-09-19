import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { deriveAdminHealth } from '../src/operations/service'
import {
  createFixtureFetch,
  syntheticFeedUrl,
  syntheticFeeds,
} from '../src/retailers/harness'
import { runScheduledRetailers } from '../src/retailers/runner'
import { createD1TestDatabase, type D1TestDatabase } from './d1'

const fixturePath = resolve('tests/fixtures/catalog.sql')
const now = 1_787_991_000_000
const retailerId = '018f47a0-0000-7000-8000-000000000001'
const listingId = '018f47a0-0000-7000-8000-000000000006'

let nextId = 0xa0
const createId = () => {
  nextId += 1
  return `018f47a0-0000-7000-8000-${nextId.toString(16).padStart(12, '0')}`
}

const runWith = (
  database: D1TestDatabase,
  fixture: keyof typeof syntheticFeeds,
  overrides: {
    mode?: 'disabled' | 'fixture' | 'live'
    now?: number
  } = {},
) =>
  runScheduledRetailers({
    database: database.binding,
    now: overrides.now ?? now,
    origin: 'scheduled',
    mode: overrides.mode ?? 'fixture',
    environment: 'local',
    createId,
    fixtureFetch: createFixtureFetch({
      [syntheticFeedUrl]: syntheticFeeds[fixture],
    }),
  })

describe('retailer acquisition runner', () => {
  let database: D1TestDatabase

  beforeEach(async () => {
    nextId = 0xa0
    database = await createD1TestDatabase()
    await database.executeFile(fixturePath)
  }, 30_000)

  afterEach(async () => {
    await database.close()
  })

  it('runs the synthetic adapter through observation, match, current Offer, and health', async () => {
    const [summary] = await runWith(database, 'normal')
    expect(summary).toMatchObject({
      retailerId,
      status: 'complete',
      fullTraversal: true,
      acceptedCount: 1,
      confirmedCount: 1,
    })

    const [offer] = await database.execute<{
      amount: number
      missCount: number
      destination: string
    }>(`
      SELECT offers.payable_amount_minor AS amount,
        listings.miss_count AS missCount,
        listings.outbound_destination AS destination
      FROM offers
      JOIN listings ON listings.id = offers.listing_id
      WHERE listings.id = '${listingId}'
    `)
    expect(offer).toEqual({
      amount: 1_999,
      missCount: 0,
      destination: 'https://synthetic.babyboel.test/sku-4plus-80',
    })

    const health = await deriveAdminHealth(database.binding, {
      now,
      deploymentId: 'synthetic-run',
    })
    expect(health.retailers[0]?.health).toBe('healthy')
    expect(health.retailers[0]?.latestRun?.status).toBe('complete')
  }, 20_000)

  it('repeats the same feed without duplicating the natural observation key', async () => {
    await runWith(database, 'normal')
    await runWith(database, 'normal')

    const [{ runs, observations }] = await database.execute<{
      runs: number
      observations: number
    }>(`
      SELECT
        (SELECT COUNT(*) FROM retailer_runs WHERE started_at = ${now}) AS runs,
        (
          SELECT COUNT(*) FROM source_observations
          WHERE response_integrity_hash = (
            SELECT response_integrity_hash FROM source_observations
            ORDER BY observed_at DESC, id DESC LIMIT 1
          )
        ) AS observations
    `)
    expect(runs).toBe(2)
    expect(observations).toBeGreaterThanOrEqual(2)
  }, 20_000)

  it('refreshes a confirmed Listing from an incomplete run without counting a miss', async () => {
    await runWith(database, 'partial')
    const [row] = await database.execute<{
      amount: number
      missCount: number
      availability: string
      fullTraversal: number
    }>(`
      SELECT offers.payable_amount_minor AS amount,
        listings.miss_count AS missCount,
        listings.availability AS availability,
        retailer_runs.full_traversal AS fullTraversal
      FROM offers
      JOIN listings ON listings.id = offers.listing_id
      JOIN retailer_runs ON retailer_runs.started_at = ${now}
      WHERE listings.id = '${listingId}'
    `)
    expect(row).toMatchObject({
      amount: 1_999,
      missCount: 0,
      availability: 'available',
      fullTraversal: 0,
    })
  }, 20_000)

  it('does not mark a Listing unavailable when a complete run has not yet accumulated two misses', async () => {
    await runWith(database, 'missingListing')
    const [row] = await database.execute<{
      missCount: number
      availability: string
    }>(`
      SELECT miss_count AS missCount, availability
      FROM listings WHERE id = '${listingId}'
    `)
    expect(row).toEqual({ missCount: 1, availability: 'available' })
    const [{ reviews }] = await database.execute<{ reviews: number }>(`
      SELECT COUNT(*) AS reviews
      FROM review_cases
      JOIN listings ON listings.id = review_cases.listing_id
      WHERE listings.retailer_sku = 'SKU-WIPES-64' AND review_cases.status = 'open'
    `)
    expect(reviews).toBe(1)
  }, 20_000)

  it('counts a stable rejected row as present without marking it unavailable', async () => {
    await runWith(database, 'stableRejected')
    const [row] = await database.execute<{
      missCount: number
      availability: string
    }>(`
      SELECT miss_count AS missCount, availability
      FROM listings WHERE id = '${listingId}'
    `)
    expect(row).toEqual({ missCount: 0, availability: 'available' })
  }, 20_000)

  it('applies stable-presence unavailability after two complete misses', async () => {
    await runWith(database, 'missingListing', { now })
    await runWith(database, 'missingListing', { now: now + 1_000 })
    const [row] = await database.execute<{
      listingAvailability: string
      offerAvailability: string
      missCount: number
    }>(`
      SELECT listings.availability AS listingAvailability,
        offers.availability AS offerAvailability,
        listings.miss_count AS missCount
      FROM listings
      JOIN offers ON offers.listing_id = listings.id
      WHERE listings.id = '${listingId}'
    `)
    expect(row).toEqual({
      listingAvailability: 'unavailable',
      offerAvailability: 'unavailable',
      missCount: 2,
    })
  }, 20_000)

  it('skips a retailer whose lease is still held', async () => {
    await database.execute(`
      UPDATE retailers
      SET lease_token = 'held-token', lease_expires_at = ${now + 60_000}
      WHERE id = '${retailerId}'
    `)
    const [summary] = await runWith(database, 'normal')
    expect(summary).toMatchObject({
      status: 'skipped',
      errorCode: 'LEASE_HELD',
    })
    const [{ count }] = await database.execute<{ count: number }>(`
      SELECT COUNT(*) AS count FROM retailer_runs WHERE status = 'skipped'
    `)
    expect(count).toBe(1)
  }, 20_000)

  it('honours independent global and retailer kill switches and continues sequentially', async () => {
    await database.execute(`
      INSERT INTO retailers (
        id, slug, name, lifecycle, created_at, updated_at
      ) VALUES (
        '018f47a0-0000-7000-8000-0000000000d1', 'paused-retailer',
        'Paused Retailer', 'paused', ${now}, ${now}
      );
      INSERT INTO retailer_sources (
        id, retailer_id, source_key, acquisition_method, authorization_status,
        reviewed_at, expires_at, retention_rule_reference, created_at, updated_at
      ) VALUES (
        '018f47a0-0000-7000-8000-0000000000d2',
        '018f47a0-0000-7000-8000-0000000000d1', 'fixture-feed', 'feed',
        'authorized', ${now}, ${now + 10_000_000}, 'tests/fixtures/source.md',
        ${now}, ${now}
      );
    `)

    const disabled = await runWith(database, 'normal', { mode: 'disabled' })
    expect(disabled.map((summary) => summary.errorCode)).toEqual([
      'GLOBAL_KILL_SWITCH',
      'GLOBAL_KILL_SWITCH',
    ])

    const sequential = await runScheduledRetailers({
      database: database.binding,
      now: now + 5_000,
      origin: 'scheduled',
      mode: 'fixture',
      environment: 'local',
      createId,
      fixtureFetch: createFixtureFetch({
        [syntheticFeedUrl]: syntheticFeeds.normal,
      }),
    })
    expect(
      sequential.map((summary) => [
        summary.retailerId,
        summary.errorCode,
        summary.status,
      ]),
    ).toEqual([
      [retailerId, null, 'complete'],
      [
        '018f47a0-0000-7000-8000-0000000000d1',
        'RETAILER_KILL_SWITCH',
        'skipped',
      ],
    ])
  }, 20_000)
})
