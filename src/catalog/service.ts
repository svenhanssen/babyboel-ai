import { and, eq, gt, gte, isNull, or, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { z } from 'zod'

import { currentOfferFreshnessMilliseconds } from '../db/domain'
import {
  brands,
  listings,
  offers,
  packages,
  products,
  retailers,
} from '../db/schema'
import {
  deriveMatchingCandidates,
  rankCurrentOffers,
  type MatchFacts,
} from './domain'

const uuidV7Schema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  )

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
