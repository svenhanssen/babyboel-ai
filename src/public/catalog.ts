import type { CategoryCode, NormalizedSizeCode } from '../db/domain'

export const publicFixtureNow = Date.parse('2026-09-11T10:00:00.000Z')
export const publicPageSize = 24
const freshnessWindow = 48 * 60 * 60 * 1_000

export interface PublicCategory {
  code: CategoryCode
  name: string
  singular: string
  slug: 'luiers' | 'luierbroekjes' | 'billendoekjes'
  sizes: readonly NormalizedSizeCode[]
}

export const publicCategories: readonly PublicCategory[] = [
  {
    code: 'disposable_diaper',
    name: 'Luiers',
    singular: 'luier',
    slug: 'luiers',
    sizes: ['1', '2', '3', '4', '4+', '5', '5+', '6'],
  },
  {
    code: 'diaper_pants',
    name: 'Luierbroekjes',
    singular: 'luierbroekje',
    slug: 'luierbroekjes',
    sizes: ['3', '4', '5', '6', '7', '8'],
  },
  {
    code: 'wipes',
    name: 'Billendoekjes',
    singular: 'billendoekje',
    slug: 'billendoekjes',
    sizes: [],
  },
] as const

export const publicCategoryBySlug = Object.fromEntries(
  publicCategories.map((category) => [category.slug, category]),
) as Record<PublicCategory['slug'], PublicCategory>

// Deliberately flattened, read-only presentation data. Product, Package,
// Listing, and Offer remain separate in the authoritative catalog model.
export interface PublicOfferView {
  id: string
  sourceOfferKey: string
  retailerName: string
  packageUnitCount: number
  requiredPackageCount: number
  totalUnits: number
  payableAmountMinor: number
  eligibility: 'universal' | 'restricted'
  conditionText: string | null
  confirmedAt: number
  outboundDestination: string
}

export interface PublicHistoryPoint {
  observedOn: string
  priceCents: number | null
  wonByMultiBuy: boolean
}

interface PublicProductFixture {
  id: string
  routeKey: string
  brand: string
  line: string
  variant: string
  category: PublicCategory['slug']
  normalizedSize: NormalizedSizeCode | null
  offers: PublicOfferView[]
  history: PublicHistoryPoint[]
  degradedRetailers?: string[]
}

export interface PublicProductSummary {
  id: string
  routeKey: string
  brand: string
  line: string
  variant: string
  category: PublicCategory['slug']
  normalizedSize: NormalizedSizeCode | null
  bestOffer: PublicOfferView | null
}

export interface PublicProduct extends Omit<PublicProductFixture, 'offers'> {
  offers: {
    primary: PublicOfferView[]
    restricted: PublicOfferView[]
    bestWithoutMinimum: PublicOfferView | null
  }
  availabilityState: 'current' | 'no_current_offer' | 'degraded'
  alternatives: PublicProductSummary[]
  degradedRetailers: string[]
}

const confirmedAt = (hoursAgo: number) =>
  publicFixtureNow - hoursAgo * 60 * 60 * 1_000

function offer(
  sourceOfferKey: string,
  retailerName: string,
  payableAmountMinor: number,
  packageUnitCount: number,
  requiredPackageCount = 1,
  eligibility: PublicOfferView['eligibility'] = 'universal',
  conditionText: string | null = null,
  hoursAgo = 3,
): PublicOfferView {
  return {
    id: `fixture-${sourceOfferKey}`,
    sourceOfferKey,
    retailerName,
    packageUnitCount,
    requiredPackageCount,
    totalUnits: packageUnitCount * requiredPackageCount,
    payableAmountMinor,
    eligibility,
    conditionText,
    confirmedAt: confirmedAt(hoursAgo),
    outboundDestination: `https://retailer.example/${sourceOfferKey}`,
  }
}

const baseHistory: PublicHistoryPoint[] = [
  { observedOn: '2026-09-07', priceCents: 24, wonByMultiBuy: false },
  { observedOn: '2026-09-08', priceCents: 22, wonByMultiBuy: true },
  { observedOn: '2026-09-09', priceCents: null, wonByMultiBuy: false },
  { observedOn: '2026-09-10', priceCents: 21, wonByMultiBuy: true },
  { observedOn: '2026-09-11', priceCents: 21, wonByMultiBuy: true },
]

const featuredDiaper: PublicProductFixture = {
  id: 'p001',
  routeKey: 'zacht-start-original-maat-4-plus-p001',
  brand: 'Zacht & Start',
  line: 'Original',
  variant: 'Zacht',
  category: 'luiers',
  normalizedSize: '4+',
  offers: [
    offer(
      'plein-multi',
      'Plein',
      1499,
      36,
      2,
      'universal',
      '2 verpakkingen van 36 stuks',
      2,
    ),
    offer('wehkamp-single', 'Wehkamp', 899, 40, 1, 'universal', null, 4),
    offer(
      'plein-member',
      'Plein',
      699,
      40,
      1,
      'restricted',
      'Alleen met ledenvoordeel',
      2,
    ),
  ],
  history: baseHistory,
}

const generatedDiapers: PublicProductFixture[] = Array.from(
  { length: 23 },
  (_, index) => {
    const number = index + 2
    const stableId = `p${String(number).padStart(3, '0')}`
    const unitCount = 40 + (index % 4) * 4
    return {
      id: stableId,
      routeKey: `kleine-wolk-lijn-${number}-maat-4-plus-${stableId}`,
      brand: index % 2 === 0 ? 'Kleine Wolk' : 'Blije Baby',
      line: `Lijn ${number}`,
      variant: index % 3 === 0 ? 'Extra zacht' : 'Original',
      category: 'luiers',
      normalizedSize: '4+',
      offers: [
        offer(
          `fixture-${stableId}`,
          index % 2 === 0 ? 'Wehkamp' : 'Plein',
          unitCount * (23 + index),
          unitCount,
          1,
          'universal',
          null,
          2 + (index % 10),
        ),
      ],
      history: baseHistory.map((point) => ({
        ...point,
        priceCents:
          point.priceCents === null ? null : point.priceCents + index + 2,
      })),
    }
  },
)

const staleDiaper: PublicProductFixture = {
  id: 'p025',
  routeKey: 'zacht-start-nacht-maat-4-plus-p025',
  brand: 'Zacht & Start',
  line: 'Nacht',
  variant: 'Extra absorberend',
  category: 'luiers',
  normalizedSize: '4+',
  offers: [offer('stale-p025', 'Plein', 1099, 44, 1, 'universal', null, 72)],
  history: baseHistory,
}

const degradedDiaper: PublicProductFixture = {
  id: 'p026',
  routeKey: 'zacht-start-comfort-maat-4-plus-p026',
  brand: 'Zacht & Start',
  line: 'Comfort',
  variant: 'Flex',
  category: 'luiers',
  normalizedSize: '4+',
  offers: [],
  history: baseHistory.slice(0, 4),
  degradedRetailers: ['Wehkamp'],
}

const otherProducts: PublicProductFixture[] = [
  {
    id: 'p101',
    routeKey: 'blije-baby-stap-voor-stap-maat-5-p101',
    brand: 'Blije Baby',
    line: 'Stap voor stap',
    variant: 'Flex',
    category: 'luierbroekjes',
    normalizedSize: '5',
    offers: [offer('pants-p101', 'Plein', 999, 36)],
    history: baseHistory,
  },
  {
    id: 'p201',
    routeKey: 'kleine-wolk-puur-water-p201',
    brand: 'Kleine Wolk',
    line: 'Puur water',
    variant: 'Ongeparfumeerd',
    category: 'billendoekjes',
    normalizedSize: null,
    offers: [offer('wipes-p201', 'Wehkamp', 749, 240)],
    history: baseHistory,
  },
]

const productFixtures: readonly PublicProductFixture[] = [
  featuredDiaper,
  ...generatedDiapers,
  staleDiaper,
  degradedDiaper,
  ...otherProducts,
]

function compareOffers(left: PublicOfferView, right: PublicOfferView) {
  const exactDifference =
    left.payableAmountMinor * right.totalUnits -
    right.payableAmountMinor * left.totalUnits
  return (
    exactDifference ||
    left.payableAmountMinor - right.payableAmountMinor ||
    left.retailerName.localeCompare(right.retailerName, 'nl') ||
    left.id.localeCompare(right.id)
  )
}

function isCurrent(offer: PublicOfferView, now: number) {
  const age = now - offer.confirmedAt
  return age >= 0 && age <= freshnessWindow
}

function rankedOffers(fixture: PublicProductFixture, now: number) {
  if (fixture.degradedRetailers?.length) {
    return { primary: [], restricted: [], bestWithoutMinimum: null }
  }
  const current = fixture.offers.filter((candidate) =>
    isCurrent(candidate, now),
  )
  const primary = current
    .filter(({ eligibility }) => eligibility === 'universal')
    .sort(compareOffers)
  const restricted = current
    .filter(({ eligibility }) => eligibility === 'restricted')
    .sort(compareOffers)
  return {
    primary,
    restricted,
    bestWithoutMinimum:
      primary.find(({ requiredPackageCount }) => requiredPackageCount === 1) ??
      null,
  }
}

function summarize(
  fixture: PublicProductFixture,
  now: number,
): PublicProductSummary {
  return {
    id: fixture.id,
    routeKey: fixture.routeKey,
    brand: fixture.brand,
    line: fixture.line,
    variant: fixture.variant,
    category: fixture.category,
    normalizedSize: fixture.normalizedSize,
    bestOffer: rankedOffers(fixture, now).primary[0] ?? null,
  }
}

function compareProducts(
  left: PublicProductSummary,
  right: PublicProductSummary,
) {
  if (left.bestOffer && right.bestOffer) {
    return (
      compareOffers(left.bestOffer, right.bestOffer) ||
      left.brand.localeCompare(right.brand, 'nl') ||
      left.line.localeCompare(right.line, 'nl') ||
      left.id.localeCompare(right.id)
    )
  }
  if (left.bestOffer) return -1
  if (right.bestOffer) return 1
  return (
    left.brand.localeCompare(right.brand, 'nl') ||
    left.line.localeCompare(right.line, 'nl') ||
    left.id.localeCompare(right.id)
  )
}

function categoryBySlug(slug: string) {
  return publicCategoryBySlug[slug as PublicCategory['slug']]
}

export function listPublicProducts(input: {
  category: string
  size?: string
  page: number
  now: number
}) {
  const category = categoryBySlug(input.category)
  if (!category) throw new Error('Categorie bestaat niet')
  if (
    (category.code === 'wipes' && input.size !== undefined) ||
    (input.size !== undefined &&
      !category.sizes.includes(input.size as NormalizedSizeCode))
  ) {
    throw new Error('Maat is niet geldig')
  }
  if (!Number.isInteger(input.page) || input.page < 1) {
    throw new Error('Pagina bestaat niet')
  }

  const products = productFixtures
    .filter(
      (product) =>
        product.category === category.slug &&
        (input.size === undefined || product.normalizedSize === input.size),
    )
    .map((product) => summarize(product, input.now))
    .sort(compareProducts)
  const pageCount = Math.max(1, Math.ceil(products.length / publicPageSize))
  if (input.page > pageCount) throw new Error('Pagina bestaat niet')
  const offset = (input.page - 1) * publicPageSize

  return {
    category,
    size: input.size ?? null,
    page: input.page,
    pageCount,
    total: products.length,
    products: products.slice(offset, offset + publicPageSize),
  }
}

export function getPublicProduct(
  routeKey: string,
  now: number,
): PublicProduct | null {
  const fixture = productFixtures.find(
    (candidate) => candidate.routeKey === routeKey,
  )
  if (!fixture) return null
  const offers = rankedOffers(fixture, now)
  const degradedRetailers = fixture.degradedRetailers ?? []
  const alternatives = productFixtures
    .filter(
      (candidate) =>
        candidate.id !== fixture.id &&
        candidate.category === fixture.category &&
        candidate.normalizedSize === fixture.normalizedSize,
    )
    .map((candidate) => summarize(candidate, now))
    .sort(compareProducts)
    .slice(0, 3)

  return {
    ...fixture,
    offers,
    alternatives,
    degradedRetailers,
    availabilityState:
      degradedRetailers.length > 0
        ? 'degraded'
        : offers.primary.length > 0
          ? 'current'
          : 'no_current_offer',
  }
}

export function listFinderProducts(category: string, size?: string) {
  return listPublicProducts({
    category,
    size,
    page: 1,
    now: publicFixtureNow,
  }).products.slice(0, 8)
}
