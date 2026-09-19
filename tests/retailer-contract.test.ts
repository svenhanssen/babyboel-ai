import { describe, expect, it } from 'vitest'

import { parseRetailerAdapterResult } from '../src/retailers/contract'

const now = 1_787_991_000_000
const offer = {
  sourceOfferKey: 'single',
  payableAmountMinor: 1_999,
  currency: 'EUR' as const,
  requiredPackageCount: 1,
  eligibility: 'universal' as const,
  conditionText: null,
  availability: 'available' as const,
  declaredExpiresAt: null,
}
const snapshot = {
  sourceListingKey: 'SKU-4PLUS-80',
  sellerKey: 'fixture-retailer',
  channel: 'nationwide_online' as const,
  sourceTitle: 'Fixture Brand Original maat 4+ 80 stuks',
  outboundDestination: 'https://synthetic.babyboel.test/sku-4plus-80',
  availability: 'available' as const,
  observedAt: now,
  rawFacts: { title: 'Fixture Brand Original maat 4+ 80 stuks' },
  normalizedFacts: {
    brand: 'Fixture Brand',
    categoryCode: 'disposable_diaper' as const,
    normalizedSizeCode: '4+' as const,
    line: 'Original',
    variant: 'Regular',
    gtin: '08712345678903',
    unitCount: 80,
    innerPackCount: 2,
    unitsPerInnerPack: 40,
  },
  extractionMethod: 'api' as const,
  outcome: 'success' as const,
  issueCodes: [] as string[],
  affectedFields: [] as string[],
  evidenceReference: {
    contentHash:
      'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
    excerpt: 'Fixture Brand Original maat 4+',
  },
  offers: [offer],
}

const validResult = {
  adapterIdentifier: 'synthetic@1',
  contractVersion: 1 as const,
  sourceKey: 'fixture-feed',
  sourceHost: 'synthetic.babyboel.test',
  retrievedAt: now,
  observedAt: now,
  responseIntegrityHash:
    'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  traversal: 'complete' as const,
  issueCodes: [] as string[],
  snapshots: [snapshot],
}

describe('retailer adapter contract', () => {
  it('accepts a complete evidence-backed Listing snapshot', () => {
    expect(parseRetailerAdapterResult(validResult).traversal).toBe('complete')
  })

  it('rejects a restricted Offer without a condition', () => {
    expect(() =>
      parseRetailerAdapterResult({
        ...validResult,
        snapshots: [
          {
            ...snapshot,
            offers: [
              {
                ...offer,
                eligibility: 'restricted',
                conditionText: null,
              },
            ],
          },
        ],
      }),
    ).toThrow()
  })

  it('rejects a non-HTTPS outbound destination', () => {
    expect(() =>
      parseRetailerAdapterResult({
        ...validResult,
        snapshots: [
          {
            ...snapshot,
            outboundDestination: 'http://synthetic.babyboel.test/sku',
          },
        ],
      }),
    ).toThrow()
  })

  it('rejects EUR amounts that are not positive integer minor units', () => {
    expect(() =>
      parseRetailerAdapterResult({
        ...validResult,
        snapshots: [
          {
            ...snapshot,
            offers: [{ ...offer, payableAmountMinor: 19.99 }],
          },
        ],
      }),
    ).toThrow()
  })
})
