import { and, asc, desc, eq, gt, gte, isNull, ne, or, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { z } from 'zod'

import { currentOfferFreshnessMilliseconds } from '../db/domain'
import { uuidV7Schema } from '../db/validation'
import {
  brands,
  listings,
  offers,
  packages,
  products,
  retailers,
  sourceObservations,
} from '../db/schema'
import {
  buildObservedPriceHistory,
  deriveMatchingCandidates,
  rankCurrentOffers,
  type MatchFacts,
} from './domain'

const currentProductOffersInputSchema = z.object({
  productId: uuidV7Schema,
  now: z.number().int().nonnegative(),
})

export async function listCurrentProductOffers(
  database: Env['DB'],
  untrustedInput: z.input<typeof currentProductOffersInputSchema>,
) {
  const input = currentProductOffersInputSchema.parse(untrustedInput)
  const db = drizzle(database)
  const rows = await db
    .select({
      offerId: sql<string>`${offers.id}`.as('offer_id'),
      sourceOfferKey: offers.sourceOfferKey,
      listingId: sql<string>`${listings.id}`.as('listing_id'),
      retailerId: sql<string>`${retailers.id}`.as('retailer_id'),
      retailerName: retailers.name,
      outboundDestination: listings.outboundDestination,
      listingConfirmedAt: sql<number>`${listings.confirmedAt}`.as(
        'listing_confirmed_at',
      ),
      packageUnitCount: packages.unitCount,
      payableAmountMinor: offers.payableAmountMinor,
      requiredPackageCount: offers.requiredPackageCount,
      totalUnits: offers.totalUnits,
      eligibility: offers.eligibility,
      conditionText: offers.conditionText,
      availability: offers.availability,
      confirmedAt: offers.confirmedAt,
      declaredExpiresAt: offers.declaredExpiresAt,
    })
    .from(offers)
    .innerJoin(listings, eq(offers.listingId, listings.id))
    .innerJoin(packages, eq(listings.packageId, packages.id))
    .innerJoin(products, eq(packages.productId, products.id))
    .innerJoin(retailers, eq(listings.retailerId, retailers.id))
    .where(
      and(
        eq(products.id, input.productId),
        eq(products.lifecycle, 'active'),
        eq(packages.lifecycle, 'active'),
        eq(listings.matchStatus, 'matched'),
        eq(listings.availability, 'available'),
        gte(
          listings.confirmedAt,
          input.now - currentOfferFreshnessMilliseconds,
        ),
        eq(offers.availability, 'available'),
        gte(offers.confirmedAt, input.now - currentOfferFreshnessMilliseconds),
        or(
          isNull(offers.declaredExpiresAt),
          gt(offers.declaredExpiresAt, input.now),
        ),
      ),
    )

  return rankCurrentOffers(rows, input.now)
}

export async function findListingMatchCandidates(
  database: Env['DB'],
  observed: MatchFacts,
) {
  if (
    observed.brand === null ||
    observed.categoryCode === null ||
    (observed.categoryCode !== 'wipes' && observed.normalizedSizeCode === null)
  ) {
    return []
  }

  const db = drizzle(database)
  const rows = await db
    .select({
      packageId: sql<string>`${packages.id}`.as('candidate_package_id'),
      brand: brands.name,
      categoryCode: products.categoryCode,
      normalizedSizeCode: products.normalizedSizeCode,
      line: products.line,
      variant: products.variant,
      gtin: packages.gtin,
      unitCount: packages.unitCount,
      innerPackCount: packages.innerPackCount,
      unitsPerInnerPack: packages.unitsPerInnerPack,
    })
    .from(packages)
    .innerJoin(products, eq(packages.productId, products.id))
    .innerJoin(brands, eq(products.brandId, brands.id))
    .where(
      and(
        eq(packages.lifecycle, 'active'),
        eq(products.lifecycle, 'active'),
        eq(brands.name, observed.brand),
        eq(products.categoryCode, observed.categoryCode),
        observed.categoryCode === 'wipes'
          ? isNull(products.normalizedSizeCode)
          : eq(products.normalizedSizeCode, observed.normalizedSizeCode!),
      ),
    )

  return deriveMatchingCandidates(
    observed,
    rows.map(({ packageId, ...facts }) => ({
      packageId,
      facts,
      active: true,
    })),
  )
}

const priceHistoryInputSchema = z.object({
  productId: uuidV7Schema,
  limit: z.number().int().min(1).max(100).default(50),
})
const observedOfferFactsSchema = z.object({
  payableAmountMinor: z.number().int().positive(),
  totalUnits: z.number().int().positive(),
  requiredPackageCount: z.number().int().positive(),
  eligibility: z.enum(['universal', 'restricted']),
  availability: z.enum(['available', 'unavailable', 'unknown']),
})

export async function listProductPriceHistory(
  database: Env['DB'],
  untrustedInput: z.input<typeof priceHistoryInputSchema>,
) {
  const input = priceHistoryInputSchema.parse(untrustedInput)
  const db = drizzle(database)
  const rows = await db
    .select({
      listingId: sourceObservations.listingId,
      sourceOfferKey: sourceObservations.sourceOfferKey,
      observedAt: sourceObservations.observedAt,
      normalizedFacts: sourceObservations.normalizedFactsJson,
    })
    .from(sourceObservations)
    .where(
      and(
        eq(sourceObservations.outcome, 'success'),
        sql`json_extract(${sourceObservations.normalizedFactsJson}, '$.productId') IN (
          WITH RECURSIVE merged_products(id) AS (
            VALUES (${input.productId})
            UNION ALL
            SELECT products.id
            FROM products
            JOIN merged_products
              ON products.merged_into_product_id = merged_products.id
          )
          SELECT id FROM merged_products
        )`,
      ),
    )
    .orderBy(desc(sourceObservations.observedAt))
    .limit(10_000)

  const facts = rows.flatMap(
    ({ listingId, sourceOfferKey, observedAt, normalizedFacts }) => {
      if (listingId === null) return []
      const parsed = observedOfferFactsSchema.safeParse(normalizedFacts)
      return parsed.success
        ? [
            {
              offerKey: `${listingId}:${sourceOfferKey}`,
              observedAt,
              ...parsed.data,
            },
          ]
        : []
    },
  )
  return buildObservedPriceHistory(facts).slice(-input.limit)
}

const productAlternativesInputSchema = z.object({
  productId: uuidV7Schema,
})

export async function listProductAlternatives(
  database: Env['DB'],
  untrustedInput: z.input<typeof productAlternativesInputSchema>,
) {
  const input = productAlternativesInputSchema.parse(untrustedInput)
  const db = drizzle(database)
  const [product] = await db
    .select({
      categoryCode: products.categoryCode,
      normalizedSizeCode: products.normalizedSizeCode,
    })
    .from(products)
    .where(eq(products.id, input.productId))
    .limit(1)
  if (!product) return []

  const alternatives = await db
    .select({
      productId: sql<string>`${products.id}`.as('alternative_product_id'),
      slug: products.slug,
      brand: brands.name,
      line: products.line,
      variant: products.variant,
      normalizedSizeCode: products.normalizedSizeCode,
    })
    .from(products)
    .innerJoin(brands, eq(products.brandId, brands.id))
    .where(
      and(
        ne(products.id, input.productId),
        eq(products.lifecycle, 'active'),
        eq(products.categoryCode, product.categoryCode),
        product.categoryCode === 'wipes'
          ? isNull(products.normalizedSizeCode)
          : eq(products.normalizedSizeCode, product.normalizedSizeCode!),
      ),
    )
    .orderBy(asc(brands.name), asc(products.line), asc(products.variant))
    .limit(3)

  return alternatives.map((alternative) => ({
    ...alternative,
    relationship:
      product.categoryCode === 'wipes'
        ? ('same_category' as const)
        : ('same_category_and_size' as const),
  }))
}
