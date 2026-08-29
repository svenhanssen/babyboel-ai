import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  findListingMatchCandidates,
  listCurrentProductOffers,
} from '../src/catalog/service'
import { createD1TestDatabase, type D1TestDatabase } from './d1'

const fixturePath = resolve('tests/fixtures/catalog.sql')
const now = 1_787_990_400_000

describe('catalog service D1 boundary', () => {
  let database: D1TestDatabase

  beforeAll(async () => {
    database = await createD1TestDatabase()
    database.executeFile(fixturePath)
    database.execute(`
      INSERT INTO offers (
        id, listing_id, source_offer_key, payable_amount_minor, currency,
        required_package_count, total_units, unit_price_numerator,
        unit_price_denominator, eligibility, condition_text, confirmed_at,
        availability, created_at, updated_at
      ) VALUES
        (
          '018f47a0-0000-7000-8000-000000000020',
          '018f47a0-0000-7000-8000-000000000006',
          'restricted', 1000, 'EUR', 1, 80, 1000, 80, 'restricted',
          'Alleen met lidmaatschap', ${now}, 'available', ${now}, ${now}
        ),
        (
          '018f47a0-0000-7000-8000-000000000021',
          '018f47a0-0000-7000-8000-000000000006',
          'multi', 3000, 'EUR', 2, 160, 3000, 160, 'universal',
          '2 verpakkingen', ${now}, 'available', ${now}, ${now}
        ),
        (
          '018f47a0-0000-7000-8000-000000000022',
          '018f47a0-0000-7000-8000-000000000006',
          'stale', 1, 'EUR', 1, 80, 1, 80, 'universal',
          NULL, ${now - 48 * 60 * 60 * 1_000 - 1}, 'available',
          ${now}, ${now}
        )
    `)
  }, 30_000)

  afterAll(async () => {
    await database.close()
  })

  it('returns only ranked current public fields and separates restricted Offers', async () => {
    const result = await listCurrentProductOffers(database.binding, {
      productId: '018f47a0-0000-7000-8000-000000000004',
      now,
    })

    expect(result.primary.map(({ sourceOfferKey }) => sourceOfferKey)).toEqual([
      'multi',
      'single',
    ])
    expect(
      result.restricted.map(({ sourceOfferKey }) => sourceOfferKey),
    ).toEqual(['restricted'])
    expect(result.bestWithoutMinimum?.sourceOfferKey).toBe('single')
    expect(JSON.stringify(result)).not.toMatch(
      /rawFacts|normalizedFacts|sanitizedExcerpt|evidenceArtifact|sourceUrl/,
    )
  })

  it('derives Review candidates from active exact catalog facts', async () => {
    const candidates = await findListingMatchCandidates(database.binding, {
      brand: 'Fixture Brand',
      categoryCode: 'disposable_diaper',
      normalizedSizeCode: '4+',
      line: 'Original',
      variant: 'Regular',
      gtin: '08712345678903',
      unitCount: 80,
      innerPackCount: 2,
      unitsPerInnerPack: 40,
    })

    expect(candidates).toEqual([
      {
        packageId: '018f47a0-0000-7000-8000-000000000005',
        agreeingFields: [
          'brand',
          'category',
          'size',
          'line',
          'variant',
          'gtin',
          'quantity',
          'innerPackCount',
          'unitsPerInnerPack',
        ],
        missingCriticalFacts: [],
        conflictReasons: [],
      },
    ])
  })

  it('fails closed for an inactive Product', async () => {
    database.execute(`
      UPDATE products
      SET lifecycle = 'inactive'
      WHERE id = '018f47a0-0000-7000-8000-000000000004'
    `)

    const result = await listCurrentProductOffers(database.binding, {
      productId: '018f47a0-0000-7000-8000-000000000004',
      now,
    })

    expect(result.primary).toEqual([])
    expect(result.restricted).toEqual([])
  }, 15_000)
})
