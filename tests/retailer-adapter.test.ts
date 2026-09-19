import { describe, expect, it } from 'vitest'

import {
  createFixtureFetch,
  extraSyntheticListing,
  syntheticFeedUrl,
  syntheticFeeds,
  syntheticListing,
} from '../src/retailers/harness'
import { runSyntheticAdapter } from '../src/retailers/synthetic'

const now = 1_787_991_000_000

const runFeed = (fixture: keyof typeof syntheticFeeds, maxItems = 50) =>
  runSyntheticAdapter({
    sourceKey: 'fixture-feed',
    sellerKey: 'fixture-retailer',
    observedAt: now,
    maxItems,
    fetch: {
      url: syntheticFeedUrl,
      allowedHosts: ['synthetic.babyboel.test'],
      timeoutMs: fixture === 'timeout' ? 20 : 50,
      maxBytes: 1_024,
      maxRedirects: 3,
      allowedContentTypes: ['application/json'],
      maxRetries: 0,
      fetch: createFixtureFetch({
        [syntheticFeedUrl]: syntheticFeeds[fixture],
      }),
      sleep: () => Promise.resolve(),
    },
  })

describe('synthetic retailer adapter', () => {
  it('maps a normal feed row to a complete snapshot', async () => {
    const result = await runFeed('normal')
    expect(result.traversal).toBe('complete')
    expect(result.snapshots).toHaveLength(1)
    expect(result.snapshots[0]).toMatchObject({
      sourceListingKey: syntheticListing.sku,
      normalizedFacts: {
        brand: 'Fixture Brand',
        categoryCode: 'disposable_diaper',
        normalizedSizeCode: '4+',
        gtin: syntheticListing.gtin,
        unitCount: 80,
      },
      offers: [{ sourceOfferKey: 'single', payableAmountMinor: 1_999 }],
      outcome: 'success',
    })
  })

  it('marks a row without Listing identity as incomplete', async () => {
    const result = await runFeed('malformed')
    expect(result.traversal).toBe('incomplete')
    expect(result.snapshots).toHaveLength(0)
    expect(result.issueCodes).toContain('ROW_IDENTITY_MISSING')
    expect(JSON.stringify(result)).not.toContain('secret-token')
  })

  it('keeps confirmed rows from a partial feed without claiming completeness', async () => {
    const result = await runFeed('partial')
    expect(result.traversal).toBe('incomplete')
    expect(result.snapshots[0]?.sourceListingKey).toBe(syntheticListing.sku)
  })

  it('drops duplicate Listing identity while remaining complete', async () => {
    const result = await runFeed('duplicate')
    expect(result.traversal).toBe('complete')
    expect(result.snapshots).toHaveLength(1)
    expect(result.issueCodes).toContain('DUPLICATE_SOURCE_LISTING')
    expect(result.snapshots[0]?.offers[0]?.payableAmountMinor).toBe(1_999)
  })

  it('detects a changed payable amount', async () => {
    const result = await runFeed('changed')
    expect(result.snapshots[0]?.offers[0]?.payableAmountMinor).toBe(1_799)
  })

  it('keeps a rejected row with Listing identity on a complete traversal', async () => {
    const result = await runFeed('stableRejected')
    expect(result.traversal).toBe('complete')
    expect(result.snapshots).toHaveLength(2)
    expect(result.snapshots[1]).toMatchObject({
      sourceListingKey: 'SKU-BROKEN-1',
      outcome: 'invalid',
      outboundDestination: null,
    })
  })

  it('can omit a previously seen Listing while keeping another row', async () => {
    const result = await runFeed('missingListing')
    expect(
      result.snapshots.map((snapshot) => snapshot.sourceListingKey),
    ).toEqual([extraSyntheticListing.sku])
  })

  it('fails closed when the item cap is exceeded', async () => {
    const result = await runFeed('duplicate', 1)
    expect(result.traversal).toBe('incomplete')
    expect(result.issueCodes).toContain('ITEM_CAP_EXCEEDED')
    expect(result.snapshots).toHaveLength(1)
  })

  it('redacts fetch failures as checked operational codes', async () => {
    const oversized = await runFeed('oversized')
    const unexpected = await runFeed('unexpectedContent')
    const unauthorized = await runFeed('unauthorized')
    expect(oversized.issueCodes).toContain('SOURCE_BYTE_CAP_EXCEEDED')
    expect(unexpected.issueCodes).toContain('SOURCE_CONTENT_TYPE_REJECTED')
    expect(unauthorized.issueCodes).toContain('SOURCE_UNAUTHORIZED')
    expect(
      JSON.stringify({ oversized, unexpected, unauthorized }),
    ).not.toContain('super-secret')
    expect(JSON.stringify(unauthorized)).not.toContain('Bearer')
  })

  it('fails closed on a hung fixture without leaking the body', async () => {
    const result = await runFeed('timeout')
    expect(result.issueCodes).toContain('SOURCE_TIMEOUT')
    expect(result.traversal).toBe('incomplete')
    expect(JSON.stringify(result)).not.toContain('items')
  })
})
