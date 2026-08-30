INSERT INTO retailers (
  id, slug, name, lifecycle, latest_run_status, latest_run_at,
  latest_successful_run_at, created_at, updated_at
) VALUES (
  '018f47a0-0000-7000-8000-000000000001', 'fixture-retailer',
  'Fixture Retailer', 'active', 'complete', 1787990400000,
  1787990400000, 1787990400000, 1787990400000
);

INSERT INTO retailer_sources (
  id, retailer_id, source_key, acquisition_method, authorization_status,
  reviewed_at, expires_at, retention_rule_reference, created_at, updated_at
) VALUES (
  '018f47a0-0000-7000-8000-000000000002',
  '018f47a0-0000-7000-8000-000000000001', 'fixture-feed', 'feed',
  'authorized', 1787990400000, 1819526400000, 'tests/fixtures/source.md',
  1787990400000, 1787990400000
);

INSERT INTO brands (id, name, slug, created_at, updated_at) VALUES
  ('018f47a0-0000-7000-8000-000000000003', 'Fixture Brand',
   'fixture-brand', 1787990400000, 1787990400000);

INSERT INTO products (
  id, brand_id, category_code, line, variant, normalized_size_code,
  identity_key, slug, lifecycle, created_at, updated_at
) VALUES (
  '018f47a0-0000-7000-8000-000000000004',
  '018f47a0-0000-7000-8000-000000000003', 'disposable_diaper',
  'Original', 'Regular', '4+', 'fixture-brand|disposable_diaper|original|regular|4+',
  'fixture-brand-original-4-plus', 'active', 1787990400000, 1787990400000
);

INSERT INTO packages (
  id, product_id, unit_count, inner_pack_count, units_per_inner_pack, gtin,
  lifecycle, created_at, updated_at
) VALUES (
  '018f47a0-0000-7000-8000-000000000005',
  '018f47a0-0000-7000-8000-000000000004', 80, 2, 40,
  '08712345678903', 'active', 1787990400000, 1787990400000
);

INSERT INTO listings (
  id, retailer_id, package_id, retailer_sku, channel, seller_retailer_id, source_title,
  outbound_destination, availability, match_status, match_method,
  last_match_decision_at, confirmed_at, miss_count, created_at, updated_at
) VALUES (
  '018f47a0-0000-7000-8000-000000000006',
  '018f47a0-0000-7000-8000-000000000001',
  '018f47a0-0000-7000-8000-000000000005', 'SKU-4PLUS-80', 'nationwide_online',
  '018f47a0-0000-7000-8000-000000000001', 'Fixture Brand Original maat 4+ 80 stuks',
  'https://retailer.example/fixture-brand-4-plus', 'available', 'matched',
  'verified_gtin', 1787990400000, 1787990400000, 0, 1787990400000, 1787990400000
);

INSERT INTO offers (
  id, listing_id, source_offer_key, payable_amount_minor, currency,
  required_package_count, total_units, unit_price_numerator,
  unit_price_denominator, eligibility, confirmed_at, availability,
  created_at, updated_at
) VALUES (
  '018f47a0-0000-7000-8000-000000000007',
  '018f47a0-0000-7000-8000-000000000006', 'single', 1999, 'EUR', 1, 80,
  1999, 80, 'universal', 1787990400000, 'available',
  1787990400000, 1787990400000
);

INSERT INTO retailer_runs (
  id, retailer_id, origin, started_at, finished_at, status, fetched_count,
  accepted_count, rejected_count, confirmed_count, full_traversal
) VALUES (
  '018f47a0-0000-7000-8000-000000000008',
  '018f47a0-0000-7000-8000-000000000001', 'scheduled', 1787990390000,
  1787990400000, 'complete', 1, 1, 0, 1, 1
);

INSERT INTO evidence_artifacts (
  id, retailer_source_id, r2_key, content_hash, artifact_type, access_class,
  stored_at, retention_deadline
) VALUES (
  '018f47a0-0000-7000-8000-000000000009',
  '018f47a0-0000-7000-8000-000000000002',
  'fixture-retailer/2026-08-29/response.json', 'sha256:fixture',
  'raw_response', 'private', 1787990400000, 1795766400000
);

INSERT INTO source_observations (
  id, retailer_source_id, retailer_run_id, listing_id, offer_id,
  evidence_artifact_id, source_listing_key, source_offer_key, observed_at,
  retrieved_at, source_url, raw_facts_json, normalized_facts_json,
  extraction_method, sanitized_excerpt, issue_codes_json,
  affected_fields_json, outcome, response_integrity_hash,
  sanitized_content_hash, observation_format, adapter_identifier
) VALUES (
  '018f47a0-0000-7000-8000-00000000000a',
  '018f47a0-0000-7000-8000-000000000002',
  '018f47a0-0000-7000-8000-000000000008',
  '018f47a0-0000-7000-8000-000000000006',
  '018f47a0-0000-7000-8000-000000000007',
  '018f47a0-0000-7000-8000-000000000009', 'SKU-4PLUS-80', 'single',
  1787990400000, 1787990400000,
  'https://retailer.example/fixture-brand-4-plus',
  '{"price":"19.99","quantity":80}',
  '{"payableAmountMinor":1999,"totalUnits":80}',
  'api', 'Fixture Brand Original maat 4+ — € 19,99', '[]', '["price"]',
  'success', 'sha256:response', 'sha256:sanitized', 1, 'fixture-adapter@1'
);

UPDATE listings
SET latest_observation_id = '018f47a0-0000-7000-8000-00000000000a'
WHERE id = '018f47a0-0000-7000-8000-000000000006';

UPDATE offers
SET latest_observation_id = '018f47a0-0000-7000-8000-00000000000a'
WHERE id = '018f47a0-0000-7000-8000-000000000007';

INSERT INTO review_cases (
  id, retailer_id, listing_id, latest_observation_id, uncertainty_type,
  status, blocks_publication, case_version, occurrence_count, notes,
  opened_at, updated_at
) VALUES (
  '018f47a0-0000-7000-8000-00000000000b',
  '018f47a0-0000-7000-8000-000000000001',
  '018f47a0-0000-7000-8000-000000000006',
  '018f47a0-0000-7000-8000-00000000000a', 'identity_conflict', 'open',
  1, 1, 1, 'Deterministic fixture review', 1787990400000, 1787990400000
);

INSERT INTO audit_log (
  id, actor, occurred_at, action, reason, target_type, target_id,
  before_json, after_json, correlation_id
) VALUES (
  '018f47a0-0000-7000-8000-00000000000c', 'fixture@example.com',
  1787990400000, 'fixture.created', 'Database integration fixture',
  'review_case', '018f47a0-0000-7000-8000-00000000000b', NULL,
  '{"status":"open"}', 'fixture-correlation'
);
