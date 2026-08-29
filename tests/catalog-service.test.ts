import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  findActivePackageByGtinAlias,
  findActivePackageByRetailerAlias,
  findListingMatchCandidates,
  listCurrentProductOffers,
  listProductObservedPriceChanges,
  listProductAlternatives,
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
      ;
      INSERT INTO source_observations (
        id, retailer_source_id, retailer_run_id, listing_id, offer_id,
        evidence_artifact_id, source_listing_key, source_offer_key,
        observed_at, retrieved_at, source_url, raw_facts_json,
        normalized_facts_json, extraction_method, sanitized_excerpt,
        issue_codes_json, affected_fields_json, outcome,
        response_integrity_hash, sanitized_content_hash, observation_format,
        adapter_identifier
      )
      SELECT
        '018f47a0-0000-7000-8000-000000000023', retailer_source_id,
        retailer_run_id, listing_id,
        '018f47a0-0000-7000-8000-000000000007', evidence_artifact_id,
        source_listing_key, 'single', ${now - 1_000}, ${now - 1_000},
        source_url, raw_facts_json,
        '{"productId":"018f47a0-0000-7000-8000-000000000004","payableAmountMinor":1999,"totalUnits":80,"requiredPackageCount":1,"eligibility":"universal","availability":"available"}',
        extraction_method, sanitized_excerpt, issue_codes_json,
        '["price"]', outcome, 'sha256:history-1', sanitized_content_hash,
        observation_format, adapter_identifier
      FROM source_observations
      WHERE id = '018f47a0-0000-7000-8000-00000000000a';
      INSERT INTO source_observations (
        id, retailer_source_id, retailer_run_id, listing_id, offer_id,
        evidence_artifact_id, source_listing_key, source_offer_key,
        observed_at, retrieved_at, source_url, raw_facts_json,
        normalized_facts_json, extraction_method, sanitized_excerpt,
        issue_codes_json, affected_fields_json, outcome,
        response_integrity_hash, sanitized_content_hash, observation_format,
        adapter_identifier
      )
      SELECT
        '018f47a0-0000-7000-8000-000000000024', retailer_source_id,
        retailer_run_id, listing_id,
        '018f47a0-0000-7000-8000-000000000007', evidence_artifact_id,
        source_listing_key, 'single', ${now}, ${now}, source_url,
        raw_facts_json,
        '{"productId":"018f47a0-0000-7000-8000-000000000004","payableAmountMinor":1799,"totalUnits":80,"requiredPackageCount":1,"eligibility":"universal","availability":"available"}',
        extraction_method, sanitized_excerpt, issue_codes_json,
        '["price"]', outcome, 'sha256:history-2', sanitized_content_hash,
        observation_format, adapter_identifier
      FROM source_observations
      WHERE id = '018f47a0-0000-7000-8000-00000000000a';
      INSERT INTO products (
        id, brand_id, category_code, line, variant, normalized_size_code,
        identity_key, slug, lifecycle, created_at, updated_at
      ) VALUES (
        '018f47a0-0000-7000-8000-000000000025',
        '018f47a0-0000-7000-8000-000000000003',
        'disposable_diaper', 'Alternative', 'Regular', '4+',
        'fixture-brand|disposable_diaper|alternative|regular|4+',
        'fixture-brand-alternative-4-plus', 'active', ${now}, ${now}
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

  it('resolves active Package aliases without guessing', async () => {
    await expect(
      findActivePackageByGtinAlias(database.binding, {
        gtin: '08712345678903',
      }),
    ).resolves.toEqual({
      packageId: '018f47a0-0000-7000-8000-000000000005',
      productId: '018f47a0-0000-7000-8000-000000000004',
    })
    await expect(
      findActivePackageByRetailerAlias(database.binding, {
        retailerId: '018f47a0-0000-7000-8000-000000000001',
        retailerSku: 'SKU-4PLUS-80',
      }),
    ).resolves.toEqual({
      listingId: '018f47a0-0000-7000-8000-000000000006',
      packageId: '018f47a0-0000-7000-8000-000000000005',
      productId: '018f47a0-0000-7000-8000-000000000004',
    })
    await expect(
      findActivePackageByRetailerAlias(database.binding, {
        retailerId: '018f47a0-0000-7000-8000-000000000001',
        retailerSku: 'unknown',
      }),
    ).resolves.toBeNull()
  })

  it('returns a bounded change-only universal price history', async () => {
    await expect(
      listProductObservedPriceChanges(database.binding, {
        productId: '018f47a0-0000-7000-8000-000000000004',
        limit: 10,
      }),
    ).resolves.toEqual([
      {
        observedAt: now - 1_000,
        payableAmountMinor: 1_999,
        totalUnits: 80,
        requiredPackageCount: 1,
        continuity: 'start',
      },
      {
        observedAt: now,
        payableAmountMinor: 1_799,
        totalUnits: 80,
        requiredPackageCount: 1,
        continuity: 'continuous',
      },
    ])
  })

  it('returns small explicitly labeled Product alternatives', async () => {
    await expect(
      listProductAlternatives(database.binding, {
        productId: '018f47a0-0000-7000-8000-000000000004',
      }),
    ).resolves.toEqual([
      {
        productId: '018f47a0-0000-7000-8000-000000000025',
        slug: 'fixture-brand-alternative-4-plus',
        brand: 'Fixture Brand',
        line: 'Alternative',
        variant: 'Regular',
        normalizedSizeCode: '4+',
        relationship: 'same_category_and_size',
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
