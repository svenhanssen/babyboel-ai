import { resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { currentOfferFreshnessMilliseconds } from '../src/db/domain'
import { createD1TestDatabase, type D1TestDatabase } from './d1'

const fixturePath = resolve('tests/fixtures/catalog.sql')
const queryPlanFixturePath = resolve('tests/fixtures/query-plan-volume.sql')
const fixtureNow = 1_787_990_400_000
const fixtureFreshnessBoundary = fixtureNow - currentOfferFreshnessMilliseconds

describe('normalized D1 catalog boundary', () => {
  let database: D1TestDatabase

  beforeAll(async () => {
    database = await createD1TestDatabase()
    database.executeFile(fixturePath)
    database.executeFile(queryPlanFixturePath)
  }, 30_000)

  afterAll(async () => {
    await database.close()
  })

  it('creates only strict application tables', () => {
    const tables = database.execute<{ name: string; strict: number }>(
      "SELECT name, strict FROM pragma_table_list WHERE schema = 'main' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('_cf_METADATA', 'd1_migrations') ORDER BY name",
    )

    expect(tables).toHaveLength(14)
    expect(tables.every(({ strict }) => strict === 1)).toBe(true)
  })

  it('uses representative deterministic volume for query plans', () => {
    const [result] = database.execute<{ products: number; offers: number }>(`
      SELECT
        (SELECT COUNT(*) FROM products) AS products,
        (SELECT COUNT(*) FROM offers) AS offers
    `)

    expect(result).toEqual({ products: 97, offers: 97 })
  })

  it('loads a coherent Product, Package, Listing, and Offer fixture', () => {
    const [result] = database.execute<{
      category: string
      normalizedSize: string
      units: number
      amount: number
      denominator: number
    }>(`
      SELECT
        products.category_code AS category,
        products.normalized_size_code AS normalizedSize,
        packages.unit_count AS units,
        offers.payable_amount_minor AS amount,
        offers.unit_price_denominator AS denominator
      FROM offers
      JOIN listings ON listings.id = offers.listing_id
      JOIN packages ON packages.id = listings.package_id
      JOIN products ON products.id = packages.product_id
    `)

    expect(result).toEqual({
      category: 'disposable_diaper',
      normalizedSize: '4+',
      units: 80,
      amount: 1999,
      denominator: 80,
    })
  })

  it('rejects invalid UUIDv7 identities', () => {
    expect(() =>
      database.execute(`
        INSERT INTO brands (id, name, slug, created_at, updated_at)
        VALUES ('not-a-uuid', 'Invalid', 'invalid', 1, 1)
      `),
    ).toThrow(/brands_id_uuidv7_check/)
  })

  it('rejects missing foreign keys', () => {
    expect(() =>
      database.execute(`
        INSERT INTO packages (
          id, product_id, unit_count, lifecycle, created_at, updated_at
        ) VALUES (
          '018f47a0-0000-7000-8000-00000000000d',
          '018f47a0-0000-7000-8000-ffffffffffff',
          10, 'active', 1, 1
        )
      `),
    ).toThrow(/FOREIGN KEY constraint failed/)
  })

  it('enforces the launch taxonomy', () => {
    expect(() =>
      database.execute(`
        INSERT INTO products (
          id, brand_id, category_code, normalized_size_code, identity_key,
          slug, lifecycle, created_at, updated_at
        ) VALUES (
          '018f47a0-0000-7000-8000-00000000000e',
          '018f47a0-0000-7000-8000-000000000003',
          'wipes', '4', 'invalid-wipes-size', 'invalid-wipes-size',
          'active', 1, 1
        )
      `),
    ).toThrow(/products_size_applicability_check/)
  })

  it('stores exact Offer operands', () => {
    expect(() =>
      database.execute(`
        INSERT INTO offers (
          id, listing_id, source_offer_key, payable_amount_minor, currency,
          required_package_count, total_units, unit_price_numerator,
          unit_price_denominator, eligibility, confirmed_at, availability,
          created_at, updated_at
        ) VALUES (
          '018f47a0-0000-7000-8000-00000000000f',
          '018f47a0-0000-7000-8000-000000000006',
          'invalid-rounded-price', 1999, 'EUR', 1, 80, 250, 10,
          'universal', 1787990400000, 'available', 1, 1
        )
      `),
    ).toThrow(/offers_unit_price_check/)
  })

  it('derives Offer units from Package quantity', () => {
    expect(() =>
      database.execute(`
        INSERT INTO offers (
          id, listing_id, source_offer_key, payable_amount_minor, currency,
          required_package_count, total_units, unit_price_numerator,
          unit_price_denominator, eligibility, confirmed_at, availability,
          created_at, updated_at
        ) VALUES (
          '018f47a0-0000-7000-8000-000000000015',
          '018f47a0-0000-7000-8000-000000000006',
          'invalid-package-total', 999, 'EUR', 1, 40, 999, 40,
          'universal', ${fixtureNow}, 'available', 1, 1
        )
      `),
    ).toThrow(/offer total units do not match its Package quantity/)
  })

  it('rejects marketplace sellers', () => {
    expect(() =>
      database.execute(`
        INSERT INTO listings (
          id, retailer_id, package_id, retailer_sku, channel,
          seller_retailer_id, source_title, outbound_destination,
          availability, match_status, match_method, last_match_decision_at,
          confirmed_at,
          miss_count, created_at, updated_at
        ) VALUES (
          '018f47a0-0000-7000-8000-000000000013',
          '018f47a0-0000-7000-8000-000000000001',
          '018f47a0-0000-7000-8000-000000000005',
          'MARKETPLACE', 'nationwide_online',
          '018f47a0-0000-7000-8000-ffffffffffff',
          'Third-party Listing', 'https://retailer.example/marketplace',
          'available', 'matched', 'manual', ${fixtureNow}, ${fixtureNow}, 0,
          ${fixtureNow}, ${fixtureNow}
        )
      `),
    ).toThrow(/listings_seller_check/)
  })

  it('rejects malformed retained JSON', () => {
    expect(() =>
      database.execute(`
        INSERT INTO audit_log (
          id, actor, occurred_at, action, reason, target_type, target_id,
          before_json, correlation_id
        ) VALUES (
          '018f47a0-0000-7000-8000-000000000014',
          'fixture@example.com', ${fixtureNow}, 'invalid.json',
          'Verify validation', 'listing',
          '018f47a0-0000-7000-8000-000000000006',
          '{not-json}', 'invalid-json'
        )
      `),
    ).toThrow(/audit_log_json_check/)
  })

  it('selects current Offers using expiry and the 48-hour freshness boundary', () => {
    const current = database.execute<{ sourceOfferKey: string }>(`
      INSERT INTO offers (
        id, listing_id, source_offer_key, payable_amount_minor, currency,
        required_package_count, total_units, unit_price_numerator,
        unit_price_denominator, eligibility, confirmed_at, declared_expires_at,
        availability, created_at, updated_at
      ) VALUES
        (
          '018f47a0-0000-7000-8000-000000000011',
          '018f47a0-0000-7000-8000-000000000006',
          'stale', 1899, 'EUR', 1, 80, 1899, 80, 'universal',
          ${fixtureFreshnessBoundary - 1}, NULL, 'available', 1, 1
        ),
        (
          '018f47a0-0000-7000-8000-000000000012',
          '018f47a0-0000-7000-8000-000000000006',
          'expired', 1799, 'EUR', 1, 80, 1799, 80, 'universal',
          ${fixtureNow - 100_000}, ${fixtureNow - 1}, 'available', 1, 1
        );
      SELECT source_offer_key AS sourceOfferKey
      FROM offers
      WHERE listing_id = '018f47a0-0000-7000-8000-000000000006'
        AND eligibility = 'universal'
        AND availability = 'available'
        AND confirmed_at >= ${fixtureFreshnessBoundary}
        AND (declared_expires_at IS NULL OR declared_expires_at > ${fixtureNow})
      ORDER BY source_offer_key
    `)

    expect(current).toEqual([{ sourceOfferKey: 'single' }])
  })

  it('deduplicates a retried source observation', () => {
    expect(() =>
      database.execute(`
        INSERT INTO source_observations
        SELECT
          '018f47a0-0000-7000-8000-000000000010',
          retailer_source_id, retailer_run_id, listing_id, offer_id,
          evidence_artifact_id, source_listing_key, source_offer_key,
          observed_at, retrieved_at, source_url, raw_facts_json,
          normalized_facts_json, extraction_method, sanitized_excerpt,
          issue_codes_json, affected_fields_json, outcome,
          response_integrity_hash, sanitized_content_hash,
          observation_format, adapter_identifier
        FROM source_observations
        WHERE id = '018f47a0-0000-7000-8000-00000000000a'
      `),
    ).toThrow(/UNIQUE constraint failed/)
  })

  it('keeps observations append-only', () => {
    expect(() =>
      database.execute(`
        UPDATE source_observations
        SET sanitized_excerpt = 'rewritten'
        WHERE id = '018f47a0-0000-7000-8000-00000000000a'
      `),
    ).toThrow(/source observations are append-only/)
  })

  it('keeps audit facts append-only', () => {
    expect(() =>
      database.execute(`
        DELETE FROM audit_log
        WHERE id = '018f47a0-0000-7000-8000-00000000000c'
      `),
    ).toThrow(/audit log is append-only/)
  })

  it.each([
    {
      name: 'Product browsing',
      sql: `
        SELECT id FROM products
        WHERE category_code = 'disposable_diaper'
          AND normalized_size_code = '4+'
          AND lifecycle = 'active'
        ORDER BY brand_id
      `,
      index: 'products_browse_idx',
    },
    {
      name: 'matched Listing lookup',
      sql: `
        SELECT id FROM listings
        WHERE package_id = '018f47a0-0000-7000-8000-000000000005'
          AND match_status = 'matched'
          AND availability = 'available'
      `,
      index: 'listings_package_status_idx',
    },
    {
      name: 'current universal Offer candidates',
      sql: `
        SELECT id FROM offers
        WHERE eligibility = 'universal'
          AND availability = 'available'
          AND confirmed_at >= ${fixtureFreshnessBoundary}
        ORDER BY payable_amount_minor
      `,
      index: 'offers_current_ranking_idx',
    },
    {
      name: 'Review inbox',
      sql: `
        SELECT id FROM review_cases
        WHERE status = 'open'
        ORDER BY blocks_publication DESC, opened_at ASC
      `,
      index: 'review_cases_queue_idx',
    },
    {
      name: 'retailer health',
      sql: `
        SELECT id FROM retailers
        WHERE lifecycle = 'active'
        ORDER BY name
      `,
      index: 'retailers_lifecycle_name_idx',
    },
    {
      name: 'expiry cleanup',
      sql: `
        SELECT id FROM evidence_artifacts
        WHERE deleted_at IS NULL AND retention_deadline <= 1795766400000
      `,
      index: 'evidence_artifacts_retention_idx',
    },
  ])('uses the intended index for $name', ({ sql, index }) => {
    const plan = database.execute<{ detail: string }>(
      `EXPLAIN QUERY PLAN ${sql}`,
    )

    expect(plan.map(({ detail }) => detail).join('\n')).toContain(index)
  })
})
