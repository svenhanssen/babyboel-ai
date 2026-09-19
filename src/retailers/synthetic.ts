import { createSourceNormalizer } from '../catalog/domain'
import {
  parseRetailerAdapterResult,
  type RetailerAdapterResult,
  type RetailerAdapterSnapshot,
} from './contract'
import {
  fetchAuthorizedSource,
  SourceFetchError,
  type AuthorizedSourceRequest,
  type FetchedSource,
} from './fetch'

export const syntheticAdapterIdentifier = 'synthetic@1'

const normalizer = createSourceNormalizer({
  categoryAliases: {
    Luiers: 'disposable_diaper',
    Luierbroekjes: 'diaper_pants',
    Billendoekjes: 'wipes',
  },
  sizeAliases: {},
})

const feedSchemaItem = (value: unknown) => {
  if (typeof value !== 'object' || value === null) return null
  const row = value as Record<string, unknown>
  const sku = typeof row.sku === 'string' ? row.sku.trim() : ''
  if (sku === '') return { sku: null, row }
  return { sku, row }
}

export type SyntheticAdapterInput = {
  sourceKey: string
  sellerKey: string
  observedAt: number
  maxItems: number
  fetch: AuthorizedSourceRequest
}

const excerptFor = (title: string, hash: string) => ({
  contentHash: hash,
  excerpt: title.slice(0, 200),
})

const textField = (value: unknown, fallback = '') =>
  typeof value === 'string' ? value : fallback

const snapshotFromRow = (input: {
  row: Record<string, unknown>
  sellerKey: string
  observedAt: number
  hash: string
  issues: string[]
}): RetailerAdapterSnapshot | null => {
  const sku = textField(input.row.sku).trim()
  if (sku === '') return null
  const title = textField(input.row.title, sku)
  const destination =
    typeof input.row.url === 'string' && input.row.url.startsWith('https://')
      ? input.row.url
      : null
  const categorySource = textField(input.row.category)
  const sizeSource = textField(input.row.size)
  const categoryCode = normalizer.category(categorySource)
  const normalizedSizeCode =
    categoryCode === 'wipes' ? null : normalizer.size(sizeSource)
  const unitCount =
    typeof input.row.unitCount === 'number' &&
    Number.isInteger(input.row.unitCount) &&
    input.row.unitCount > 0
      ? input.row.unitCount
      : null
  const innerPackCount =
    typeof input.row.innerPackCount === 'number'
      ? input.row.innerPackCount
      : null
  const unitsPerInnerPack =
    typeof input.row.unitsPerInnerPack === 'number'
      ? input.row.unitsPerInnerPack
      : null
  const gtin = typeof input.row.gtin === 'string' ? input.row.gtin : null
  const priceMinor =
    typeof input.row.priceMinor === 'number' &&
    Number.isInteger(input.row.priceMinor) &&
    input.row.priceMinor > 0
      ? input.row.priceMinor
      : null
  const availability: 'available' | 'unavailable' | 'unknown' =
    input.row.availability === 'unavailable' ||
    input.row.availability === 'unknown'
      ? input.row.availability
      : 'available'
  const issues = [...input.issues]
  if (categoryCode === null) issues.push('category_unmapped')
  if (categoryCode !== 'wipes' && normalizedSizeCode === null) {
    issues.push('size_unmapped')
  }
  if (unitCount === null) issues.push('quantity_invalid')
  if (priceMinor === null) issues.push('price_invalid')
  if (destination === null) issues.push('destination_invalid')
  const success =
    issues.length === 0 &&
    destination !== null &&
    categoryCode !== null &&
    unitCount !== null
  const offers =
    success && priceMinor !== null
      ? [
          {
            sourceOfferKey: 'single',
            payableAmountMinor: priceMinor,
            currency: 'EUR' as const,
            requiredPackageCount: 1,
            eligibility: 'universal' as const,
            conditionText: null,
            availability,
            declaredExpiresAt: null,
          },
        ]
      : []

  return {
    sourceListingKey: sku,
    sellerKey: input.sellerKey,
    channel: 'nationwide_online',
    sourceTitle: title.slice(0, 500) || sku,
    outboundDestination:
      destination ??
      `https://synthetic.babyboel.test/unverified/${encodeURIComponent(sku)}`,
    availability,
    observedAt: input.observedAt,
    rawFacts: {
      sku,
      title,
      category: categorySource,
      size: sizeSource,
      priceMinor: input.row.priceMinor ?? null,
    },
    normalizedFacts: {
      brand: typeof input.row.brand === 'string' ? input.row.brand : null,
      categoryCode,
      normalizedSizeCode,
      line: typeof input.row.line === 'string' ? input.row.line : null,
      variant: typeof input.row.variant === 'string' ? input.row.variant : null,
      gtin,
      unitCount,
      innerPackCount,
      unitsPerInnerPack,
    },
    extractionMethod: 'api',
    outcome: success ? 'success' : 'invalid',
    issueCodes: issues,
    affectedFields: issues.map((issue) => issue.split('_')[0] ?? issue),
    evidenceReference: excerptFor(title, input.hash),
    offers,
  }
}

export async function runSyntheticAdapter(
  input: SyntheticAdapterInput,
): Promise<RetailerAdapterResult> {
  let fetched
  try {
    fetched = await fetchAuthorizedSource(input.fetch)
  } catch (error) {
    const code =
      error instanceof SourceFetchError ? error.code : 'SOURCE_FETCH_FAILED'
    return parseRetailerAdapterResult({
      adapterIdentifier: syntheticAdapterIdentifier,
      contractVersion: 1 as const,
      sourceKey: input.sourceKey,
      sourceHost: new URL(input.fetch.url).hostname,
      retrievedAt: input.observedAt,
      observedAt: input.observedAt,
      responseIntegrityHash:
        'sha256:0000000000000000000000000000000000000000000000000000000000000000',
      traversal: 'incomplete',
      issueCodes: [code],
      snapshots: [],
    })
  }

  return parseFeed(fetched, input)
}

const parseFeed = (
  fetched: FetchedSource,
  input: SyntheticAdapterInput,
): RetailerAdapterResult => {
  let parsed: unknown
  try {
    parsed = JSON.parse(fetched.bodyText) as unknown
  } catch {
    return parseRetailerAdapterResult({
      adapterIdentifier: syntheticAdapterIdentifier,
      contractVersion: 1 as const,
      sourceKey: input.sourceKey,
      sourceHost: new URL(input.fetch.url).hostname,
      retrievedAt: input.observedAt,
      observedAt: input.observedAt,
      responseIntegrityHash: fetched.integrityHash,
      traversal: 'incomplete',
      issueCodes: ['FEED_MALFORMED'],
      snapshots: [],
    })
  }
  if (typeof parsed !== 'object' || parsed === null || !('items' in parsed)) {
    return parseRetailerAdapterResult({
      adapterIdentifier: syntheticAdapterIdentifier,
      contractVersion: 1 as const,
      sourceKey: input.sourceKey,
      sourceHost: new URL(input.fetch.url).hostname,
      retrievedAt: input.observedAt,
      observedAt: input.observedAt,
      responseIntegrityHash: fetched.integrityHash,
      traversal: 'incomplete',
      issueCodes: ['FEED_MALFORMED'],
      snapshots: [],
    })
  }
  const feed = parsed as { complete?: unknown; items: unknown }
  if (!Array.isArray(feed.items)) {
    return parseRetailerAdapterResult({
      adapterIdentifier: syntheticAdapterIdentifier,
      contractVersion: 1 as const,
      sourceKey: input.sourceKey,
      sourceHost: new URL(input.fetch.url).hostname,
      retrievedAt: input.observedAt,
      observedAt: input.observedAt,
      responseIntegrityHash: fetched.integrityHash,
      traversal: 'incomplete',
      issueCodes: ['FEED_MALFORMED'],
      snapshots: [],
    })
  }

  const issueCodes: string[] = []
  let traversal: 'complete' | 'incomplete' =
    feed.complete === false ? 'incomplete' : 'complete'
  if (feed.items.length > input.maxItems) {
    issueCodes.push('ITEM_CAP_EXCEEDED')
    traversal = 'incomplete'
  }
  const items = feed.items.slice(0, input.maxItems)
  const snapshots: RetailerAdapterSnapshot[] = []
  const seen = new Set<string>()
  for (const item of items) {
    const parsedItem = feedSchemaItem(item)
    if (parsedItem === null || parsedItem.sku === null) {
      issueCodes.push('ROW_IDENTITY_MISSING')
      traversal = 'incomplete'
      continue
    }
    const duplicate = seen.has(parsedItem.sku)
    seen.add(parsedItem.sku)
    if (duplicate) {
      issueCodes.push('DUPLICATE_SOURCE_LISTING')
      continue
    }
    const snapshot = snapshotFromRow({
      row: parsedItem.row,
      sellerKey: input.sellerKey,
      observedAt: input.observedAt,
      hash: fetched.integrityHash,
      issues: [],
    })
    if (snapshot) snapshots.push(snapshot)
  }

  return parseRetailerAdapterResult({
    adapterIdentifier: syntheticAdapterIdentifier,
    contractVersion: 1 as const,
    sourceKey: input.sourceKey,
    sourceHost: new URL(input.fetch.url).hostname,
    retrievedAt: input.observedAt,
    observedAt: input.observedAt,
    responseIntegrityHash: fetched.integrityHash,
    traversal,
    issueCodes,
    snapshots,
  })
}
