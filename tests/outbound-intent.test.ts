import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { handleOutboundIntent } from '../src/public/intent'
import { createD1TestDatabase, type D1TestDatabase } from './d1'

describe('outbound intent collection', () => {
  let database: D1TestDatabase

  beforeEach(async () => {
    database = await createD1TestDatabase()
  }, 30_000)

  afterEach(async () => {
    await database.close()
  })

  it('stores only closed aggregate dimensions', async () => {
    const first = await handleOutboundIntent(
      new Request('https://babyboel.nl/intent', {
        method: 'POST',
        headers: {
          origin: 'https://babyboel.nl',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          retailer: 'plein',
          listing: 'fixture-listing-plein-multi',
          placement: 'product_offer',
          affiliate: true,
        }),
      }),
      database.binding,
      Date.parse('2026-09-11T10:00:00.000Z'),
    )
    await handleOutboundIntent(
      new Request('https://babyboel.nl/intent', {
        method: 'POST',
        headers: {
          origin: 'https://babyboel.nl',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          retailer: 'plein',
          listing: 'fixture-listing-plein-multi',
          placement: 'product_offer',
          affiliate: true,
        }),
      }),
      database.binding,
      Date.parse('2026-09-11T10:00:00.000Z'),
    )

    expect(first.status).toBe(204)
    const rows = await database.execute(
      'SELECT utc_day, retailer_slug, listing_key, placement_code, affiliate, count FROM outbound_intent_counts',
    )
    expect(rows).toEqual([
      {
        utc_day: '2026-09-11',
        retailer_slug: 'plein',
        listing_key: 'fixture-listing-plein-multi',
        placement_code: 'product_offer',
        affiliate: 1,
        count: 2,
      },
    ])
    expect(JSON.stringify(rows)).not.toMatch(/visitor|user-agent|ip|secret/i)
  })

  it('rejects extra identity fields and unknown dimensions', async () => {
    const extra = await handleOutboundIntent(
      new Request('https://babyboel.nl/intent', {
        method: 'POST',
        headers: {
          origin: 'https://babyboel.nl',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          retailer: 'plein',
          listing: 'fixture-listing-plein-multi',
          placement: 'product_offer',
          affiliate: true,
          visitorId: 'abc',
        }),
      }),
      database.binding,
      Date.parse('2026-09-11T10:00:00.000Z'),
    )
    const unknown = await handleOutboundIntent(
      new Request('https://babyboel.nl/intent', {
        method: 'POST',
        headers: {
          origin: 'https://babyboel.nl',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          retailer: 'unknown',
          listing: 'fixture-listing-plein-multi',
          placement: 'product_offer',
          affiliate: false,
        }),
      }),
      database.binding,
      Date.parse('2026-09-11T10:00:00.000Z'),
    )
    const crossOrigin = await handleOutboundIntent(
      new Request('https://babyboel.nl/intent', {
        method: 'POST',
        headers: {
          origin: 'https://attacker.example',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          retailer: 'plein',
          listing: 'fixture-listing-plein-multi',
          placement: 'product_offer',
          affiliate: true,
        }),
      }),
      database.binding,
      Date.parse('2026-09-11T10:00:00.000Z'),
    )

    expect(extra.status).toBe(400)
    expect(unknown.status).toBe(400)
    expect(crossOrigin.status).toBe(403)
    expect(
      await database.execute('SELECT count FROM outbound_intent_counts'),
    ).toEqual([])
  })
})
