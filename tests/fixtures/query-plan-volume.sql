WITH RECURSIVE fixture_numbers(value) AS (
  VALUES (1)
  UNION ALL
  SELECT value + 1 FROM fixture_numbers WHERE value < 96
)
INSERT INTO products (
  id, brand_id, category_code, line, variant, normalized_size_code,
  identity_key, slug, lifecycle, created_at, updated_at
)
SELECT
  printf('018f47b1-%04x-7000-8000-%012x', value, value),
  '018f47a0-0000-7000-8000-000000000003',
  'disposable_diaper',
  'Query plan line ' || value,
  'Regular',
  '4+',
  'query-plan-product-' || value,
  'query-plan-product-' || value,
  'active',
  1787990400000,
  1787990400000
FROM fixture_numbers;

WITH RECURSIVE fixture_numbers(value) AS (
  VALUES (1)
  UNION ALL
  SELECT value + 1 FROM fixture_numbers WHERE value < 96
)
INSERT INTO packages (
  id, product_id, unit_count, lifecycle, created_at, updated_at
)
SELECT
  printf('018f47b2-%04x-7000-8000-%012x', value, value),
  printf('018f47b1-%04x-7000-8000-%012x', value, value),
  80,
  'active',
  1787990400000,
  1787990400000
FROM fixture_numbers;

WITH RECURSIVE fixture_numbers(value) AS (
  VALUES (1)
  UNION ALL
  SELECT value + 1 FROM fixture_numbers WHERE value < 96
)
INSERT INTO listings (
  id, retailer_id, package_id, retailer_sku, channel, seller_retailer_id,
  source_title, outbound_destination, availability, match_status, match_method,
  confirmed_at, miss_count, created_at, updated_at
)
SELECT
  printf('018f47b3-%04x-7000-8000-%012x', value, value),
  '018f47a0-0000-7000-8000-000000000001',
  printf('018f47b2-%04x-7000-8000-%012x', value, value),
  'QUERY-PLAN-' || value,
  'nationwide_online',
  '018f47a0-0000-7000-8000-000000000001',
  'Query plan Listing ' || value,
  'https://retailer.example/query-plan-' || value,
  'available',
  'matched',
  'manual',
  1787990400000,
  0,
  1787990400000,
  1787990400000
FROM fixture_numbers;

WITH RECURSIVE fixture_numbers(value) AS (
  VALUES (1)
  UNION ALL
  SELECT value + 1 FROM fixture_numbers WHERE value < 96
)
INSERT INTO offers (
  id, listing_id, source_offer_key, payable_amount_minor, currency,
  required_package_count, total_units, unit_price_numerator,
  unit_price_denominator, eligibility, confirmed_at, availability,
  created_at, updated_at
)
SELECT
  printf('018f47b4-%04x-7000-8000-%012x', value, value),
  printf('018f47b3-%04x-7000-8000-%012x', value, value),
  'single',
  1000 + value,
  'EUR',
  1,
  80,
  1000 + value,
  80,
  'universal',
  1787990400000,
  'available',
  1787990400000,
  1787990400000
FROM fixture_numbers;
