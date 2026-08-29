import { describe, expect, it } from 'vitest'

import {
  buildProductIdentityKey,
  buildObservedPriceHistory,
  calculateOfferPrice,
  createSourceNormalizer,
  decideListingMatch,
  deriveMatchingCandidates,
  parseNormalizedSize,
  rankCurrentOffers,
  type MatchFacts,
  type RankedOffer,
} from '../src/catalog/domain'

const now = 1_787_990_400_000

const facts = (overrides: Partial<MatchFacts> = {}): MatchFacts => ({
  brand: 'Pampers',
  categoryCode: 'disposable_diaper',
  normalizedSizeCode: '4+',
  line: 'Premium Protection',
  variant: 'Regular',
  gtin: '8700216751292',
  unitCount: 80,
  innerPackCount: 2,
  unitsPerInnerPack: 40,
  ...overrides,
})

const offer = (overrides: Partial<RankedOffer> = {}): RankedOffer => ({
  offerId: 'offer-a',
  listingId: 'listing-a',
  retailerId: 'retailer-a',
  retailerName: 'Albert',
  listingConfirmedAt: now,
  payableAmountMinor: 1_999,
  requiredPackageCount: 1,
  totalUnits: 80,
  eligibility: 'universal',
  conditionText: null,
  availability: 'available',
  confirmedAt: now,
  declaredExpiresAt: null,
  ...overrides,
})

describe('catalog domain', () => {
  it.each([
    ['maat 4', '4'],
    ['mt. 4+', '4+'],
    ['SIZE 5+', '5+'],
    ['maat 4-5', null],
    ['10-15 kg', null],
    ['Junior', null],
    ['maat 9', null],
  ])('parses only an exact normalized size from %s', (source, expected) => {
    expect(parseNormalizedSize(source)).toBe(expected)
  })

  it('keeps plus sizes distinct in exact Product identity', () => {
    expect(
      buildProductIdentityKey({
        brand: 'Pampers',
        categoryCode: 'disposable_diaper',
        line: 'Premium Protection',
        variant: null,
        normalizedSizeCode: '4',
      }),
    ).not.toBe(
      buildProductIdentityKey({
        brand: 'Pampers',
        categoryCode: 'disposable_diaper',
        line: 'Premium Protection',
        variant: null,
        normalizedSizeCode: '4+',
      }),
    )
  })

  it('uses only explicit adapter-local category and size aliases', () => {
    const normalize = createSourceNormalizer({
      categoryAliases: {
        Luiers: 'disposable_diaper',
      },
      sizeAliases: {
        'Maat Vier Plus': '4+',
      },
    })

    expect(normalize.category('Luiers')).toBe('disposable_diaper')
    expect(normalize.size('Maat Vier Plus')).toBe('4+')
    expect(normalize.size('maat 4+')).toBe('4+')
    expect(normalize.size('Junior')).toBeNull()
  })

  it.each([
    {
      name: 'one Package',
      input: {
        payableAmountMinor: 1_999,
        packageUnitCount: 80,
        requiredPackageCount: 1,
      },
      expected: {
        requiredPackageCount: 1,
        totalUnits: 80,
        unitPriceNumerator: 1_999,
        unitPriceDenominator: 80,
      },
    },
    {
      name: 'identical-Package multi-buy',
      input: {
        payableAmountMinor: 3_000,
        packageUnitCount: 40,
        requiredPackageCount: 3,
      },
      expected: {
        requiredPackageCount: 3,
        totalUnits: 120,
        unitPriceNumerator: 3_000,
        unitPriceDenominator: 120,
      },
    },
  ])('calculates exact Offer operands for $name', ({ input, expected }) => {
    expect(calculateOfferPrice(input)).toEqual(expected)
  })

  it.each([
    {
      payableAmountMinor: 0,
      packageUnitCount: 80,
      requiredPackageCount: 1,
    },
    {
      payableAmountMinor: 1_999,
      packageUnitCount: 0,
      requiredPackageCount: 1,
    },
    {
      payableAmountMinor: 1_999,
      packageUnitCount: Number.MAX_SAFE_INTEGER,
      requiredPackageCount: 2,
    },
  ])('rejects invalid or unsafe Offer operands', (input) => {
    expect(() => calculateOfferPrice(input)).toThrow('INVALID_OFFER_PRICE')
  })

  it('ranks current universal Offers by exact unit price and deterministic tie-breaks', () => {
    const ranked = rankCurrentOffers(
      [
        offer({
          offerId: 'restricted',
          payableAmountMinor: 1,
          eligibility: 'restricted',
          conditionText: 'Alleen met lidmaatschap',
        }),
        offer({
          offerId: 'stale',
          payableAmountMinor: 1,
          confirmedAt: now - 48 * 60 * 60 * 1_000 - 1,
        }),
        offer({
          offerId: 'multi',
          payableAmountMinor: 3_000,
          requiredPackageCount: 2,
          totalUnits: 160,
        }),
        offer({
          offerId: 'single',
          payableAmountMinor: 1_500,
          totalUnits: 80,
        }),
        offer({
          offerId: 'later-retailer',
          retailerId: 'retailer-z',
          retailerName: 'Zulu',
          payableAmountMinor: 1_500,
          totalUnits: 80,
        }),
      ],
      now,
    )

    expect(ranked.primary.map(({ offerId }) => offerId)).toEqual([
      'single',
      'later-retailer',
      'multi',
    ])
    expect(ranked.bestWithoutMinimum?.offerId).toBe('single')
    expect(ranked.restricted.map(({ offerId }) => offerId)).toEqual([
      'restricted',
    ])
  })

  it('treats the exact 48-hour boundary as current and a declared expiry as exclusive', () => {
    const ranked = rankCurrentOffers(
      [
        offer({
          offerId: 'boundary',
          confirmedAt: now - 48 * 60 * 60 * 1_000,
        }),
        offer({ offerId: 'expired', declaredExpiresAt: now }),
        offer({ offerId: 'unavailable', availability: 'unavailable' }),
      ],
      now,
    )

    expect(ranked.primary.map(({ offerId }) => offerId)).toEqual(['boundary'])
  })

  it('does not publish an Offer whose outbound destination is stale', () => {
    const ranked = rankCurrentOffers(
      [
        offer({
          offerId: 'stale-destination',
          listingConfirmedAt: now - 48 * 60 * 60 * 1_000 - 1,
        }),
      ],
      now,
    )

    expect(ranked.primary).toEqual([])
  })

  it('keeps only changed universal price points and marks evidence gaps', () => {
    const history = buildObservedPriceHistory([
      {
        offerKey: 'single',
        observedAt: now - 100_000,
        payableAmountMinor: 1_999,
        totalUnits: 80,
        requiredPackageCount: 1,
        eligibility: 'universal',
        availability: 'available',
      },
      {
        offerKey: 'other',
        observedAt: now - 75_000,
        payableAmountMinor: 3_000,
        totalUnits: 80,
        requiredPackageCount: 1,
        eligibility: 'universal',
        availability: 'available',
      },
      {
        offerKey: 'single',
        observedAt: now - 50_000,
        payableAmountMinor: 1_999,
        totalUnits: 80,
        requiredPackageCount: 1,
        eligibility: 'universal',
        availability: 'available',
      },
      {
        offerKey: 'restricted',
        observedAt: now - 25_000,
        payableAmountMinor: 999,
        totalUnits: 80,
        requiredPackageCount: 1,
        eligibility: 'restricted',
        availability: 'available',
      },
      {
        offerKey: 'other',
        observedAt: now - 20_000,
        payableAmountMinor: 3_000,
        totalUnits: 80,
        requiredPackageCount: 1,
        eligibility: 'universal',
        availability: 'unavailable',
      },
      {
        offerKey: 'single',
        observedAt: now - 10_000,
        payableAmountMinor: 1_799,
        totalUnits: 80,
        requiredPackageCount: 1,
        eligibility: 'universal',
        availability: 'available',
      },
      {
        offerKey: 'single',
        observedAt: now - 5_000,
        payableAmountMinor: 1_799,
        totalUnits: 80,
        requiredPackageCount: 1,
        eligibility: 'universal',
        availability: 'unavailable',
      },
      {
        offerKey: 'single',
        observedAt: now,
        payableAmountMinor: 1_699,
        totalUnits: 80,
        requiredPackageCount: 1,
        eligibility: 'universal',
        availability: 'available',
      },
    ])

    expect(history).toEqual([
      {
        observedAt: now - 100_000,
        payableAmountMinor: 1_999,
        totalUnits: 80,
        requiredPackageCount: 1,
        continuity: 'start',
      },
      {
        observedAt: now - 10_000,
        payableAmountMinor: 1_799,
        totalUnits: 80,
        requiredPackageCount: 1,
        continuity: 'continuous',
      },
      {
        observedAt: now,
        payableAmountMinor: 1_699,
        totalUnits: 80,
        requiredPackageCount: 1,
        continuity: 'start',
      },
    ])
  })

  it('reuses an approved Listing only for an unchanged clean fingerprint', () => {
    expect(
      decideListingMatch({
        observed: facts(),
        approved: {
          packageId: 'package-approved',
          fingerprint: facts(),
          automaticReuseBlocked: false,
        },
        verifiedGtinPackages: [],
      }),
    ).toEqual({
      kind: 'matched',
      packageId: 'package-approved',
      method: 'approved_listing',
      firstAutomaticMatchAudit: false,
    })
  })

  it.each([
    ['category', { categoryCode: 'diaper_pants' }],
    ['brand', { brand: 'Huggies' }],
    ['size', { normalizedSizeCode: '4' }],
    ['line', { line: 'Baby Dry' }],
    ['variant', { variant: 'Night' }],
    ['GTIN', { gtin: '8710103990127' }],
    ['quantity', { unitCount: 84 }],
    ['composition', { innerPackCount: 4, unitsPerInnerPack: 20 }],
  ])('fails closed on a conflicting %s fact', (_name, conflicting) => {
    expect(
      decideListingMatch({
        observed: facts(conflicting as Partial<MatchFacts>),
        approved: null,
        verifiedGtinPackages: [
          { packageId: 'package-a', facts: facts(), active: true },
        ],
      }),
    ).toMatchObject({ kind: 'review', uncertaintyType: 'contradiction' })
  })

  it('matches one active Package through an authoritative valid GTIN', () => {
    expect(
      decideListingMatch({
        observed: facts(),
        approved: null,
        verifiedGtin: {
          value: '8700216751292',
          provenance: 'authorized_feed',
        },
        verifiedGtinPackages: [
          { packageId: 'package-a', facts: facts(), active: true },
        ],
      }),
    ).toEqual({
      kind: 'matched',
      packageId: 'package-a',
      method: 'verified_gtin',
      firstAutomaticMatchAudit: true,
    })
  })

  it.each([
    { value: '8700216751298', provenance: 'authorized_feed' as const },
    { value: '8700216751292', provenance: 'retailer_page' as const },
  ])('rejects a non-authoritative verified-GTIN path', (verifiedGtin) => {
    expect(
      decideListingMatch({
        observed: facts(),
        approved: null,
        verifiedGtin,
        verifiedGtinPackages: [
          { packageId: 'package-a', facts: facts(), active: true },
        ],
      }),
    ).toMatchObject({ kind: 'review' })
  })

  it('returns at most three exact human Review candidates with explanations', () => {
    const candidates = deriveMatchingCandidates(facts({ gtin: null }), [
      {
        packageId: 'exact',
        facts: facts({ gtin: null }),
        active: true,
      },
      {
        packageId: 'quantity-missing',
        facts: facts({ gtin: null, unitCount: null }),
        active: true,
      },
      {
        packageId: 'variant-missing',
        facts: facts({ gtin: null, variant: null }),
        active: true,
      },
      {
        packageId: 'fourth',
        facts: facts({ gtin: null, line: null }),
        active: true,
      },
      {
        packageId: 'conflict',
        facts: facts({ gtin: null, normalizedSizeCode: '4' }),
        active: true,
      },
    ])

    expect(candidates.map(({ packageId }) => packageId)).toEqual([
      'exact',
      'quantity-missing',
      'variant-missing',
    ])
    expect(candidates[0]?.agreeingFields).toEqual([
      'brand',
      'category',
      'size',
      'line',
      'variant',
      'quantity',
      'innerPackCount',
      'unitsPerInnerPack',
    ])
    expect(candidates[0]?.missingCriticalFacts).toEqual(['gtin'])
  })
})
