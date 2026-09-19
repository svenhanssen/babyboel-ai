import { SourceFetchError } from './fetch'

export type FixtureFeed = {
  status?: number
  headers?: Record<string, string>
  body: string
  delayMs?: number
}

export function createFixtureFetch(
  feeds: Readonly<Record<string, FixtureFeed>>,
): typeof globalThis.fetch {
  return async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url
    const fixture = feeds[url]
    if (!fixture) {
      throw new SourceFetchError('SOURCE_HOST_REJECTED')
    }
    if (fixture.delayMs && fixture.delayMs > 0) {
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(resolve, fixture.delayMs)
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(timeout)
          reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
        })
      })
    }
    return new Response(fixture.body, {
      status: fixture.status ?? 200,
      headers: {
        'content-type': 'application/json',
        ...fixture.headers,
      },
    })
  }
}

export const syntheticFeedUrl = 'https://synthetic.babyboel.test/feed.json'

export const syntheticListing = {
  sku: 'SKU-4PLUS-80',
  title: 'Fixture Brand Original maat 4+ 80 stuks',
  url: 'https://synthetic.babyboel.test/sku-4plus-80',
  brand: 'Fixture Brand',
  category: 'Luiers',
  size: 'maat 4+',
  line: 'Original',
  variant: 'Regular',
  gtin: '08712345678903',
  unitCount: 80,
  innerPackCount: 2,
  unitsPerInnerPack: 40,
  priceMinor: 1_999,
  availability: 'available',
} as const

export const extraSyntheticListing = {
  ...syntheticListing,
  sku: 'SKU-WIPES-64',
  title: 'Fixture Brand billendoekjes 64 stuks',
  url: 'https://synthetic.babyboel.test/sku-wipes-64',
  category: 'Billendoekjes',
  size: null,
  gtin: null,
  unitCount: 64,
  innerPackCount: null,
  unitsPerInnerPack: null,
  priceMinor: 399,
} as const

const feedBody = (input: { complete?: boolean; items: unknown[] }) =>
  JSON.stringify({
    complete: input.complete ?? true,
    items: input.items,
  })

export const syntheticFeeds = {
  normal: {
    body: feedBody({ items: [syntheticListing] }),
  },
  malformed: {
    body: feedBody({
      items: [
        {
          title: 'broken row without identity',
          priceMinor: 'secret-token=abc',
        },
      ],
    }),
  },
  partial: {
    body: feedBody({
      complete: false,
      items: [syntheticListing],
    }),
  },
  duplicate: {
    body: feedBody({
      items: [syntheticListing, { ...syntheticListing, priceMinor: 1_499 }],
    }),
  },
  changed: {
    body: feedBody({
      items: [{ ...syntheticListing, priceMinor: 1_799 }],
    }),
  },
  missingListing: {
    body: feedBody({ items: [extraSyntheticListing] }),
  },
  stableRejected: {
    body: feedBody({
      items: [
        syntheticListing,
        { sku: 'SKU-BROKEN-1', title: 'Broken identity row' },
      ],
    }),
  },
  oversized: {
    body: 'n'.repeat(2_048),
    headers: {
      'content-type': 'application/json',
      'content-length': '2048',
    },
  },
  unexpectedContent: {
    body: '<html>captcha token=super-secret</html>',
    headers: { 'content-type': 'text/html' },
  },
  unauthorized: {
    status: 401,
    body: 'Bearer secret-token',
  },
} satisfies Record<string, FixtureFeed>
