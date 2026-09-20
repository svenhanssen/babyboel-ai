import {
  ingestValidatedOfferObservation,
  matchObservedListing,
  recordIdentityObservation,
  upsertObservedListing,
} from '../catalog/ingestion'
import { calculateOfferPrice, createMatchFingerprint } from '../catalog/domain'
import { createUuidV7 } from '../db/uuid'
import type { RetailerAdapterResult } from './contract'

type PersistEnvironment = {
  database: Env['DB']
  now: number
  createId?: () => string
}

export const persistAdapterSnapshot = async (
  environment: PersistEnvironment,
  input: {
    retailerId: string
    retailerSlug: string
    sourceId: string
    runId: string
    result: RetailerAdapterResult
    snapshot: RetailerAdapterResult['snapshots'][number]
  },
) => {
  const createId = environment.createId ?? createUuidV7
  const snapshot = input.snapshot
  if (
    snapshot.sellerKey !== input.retailerSlug ||
    snapshot.outboundDestination === null
  ) {
    return { accepted: false, confirmed: false }
  }
  const identityId = createId()
  await recordIdentityObservation(environment.database, {
    id: identityId,
    retailerSourceId: input.sourceId,
    retailerRunId: input.runId,
    sourceListingKey: snapshot.sourceListingKey,
    sourceOfferKey: 'identity',
    observedAt: input.result.observedAt,
    retrievedAt: input.result.retrievedAt,
    sourceUrl: snapshot.outboundDestination,
    rawFacts: snapshot.rawFacts,
    normalizedFacts: snapshot.normalizedFacts,
    extractionMethod: snapshot.extractionMethod,
    sanitizedExcerpt: snapshot.evidenceReference.excerpt,
    issueCodes: snapshot.issueCodes,
    affectedFields: snapshot.affectedFields,
    outcome: snapshot.outcome,
    responseIntegrityHash: input.result.responseIntegrityHash,
    sanitizedContentHash: snapshot.evidenceReference.contentHash,
    observationFormat: 1,
    adapterIdentifier: input.result.adapterIdentifier,
  })
  if (snapshot.outcome !== 'success') {
    return { accepted: false, confirmed: false }
  }
  const listing = await upsertObservedListing(environment.database, {
    listingId: createId(),
    retailerId: input.retailerId,
    retailerSku: snapshot.sourceListingKey,
    sourceTitle: snapshot.sourceTitle,
    outboundDestination: snapshot.outboundDestination,
    availability: snapshot.availability,
    observedAt: environment.now,
  })
  const listingState = await environment.database
    .prepare(
      `SELECT match_status AS matchStatus, match_fingerprint AS matchFingerprint,
        package_id AS packageId
       FROM listings WHERE id = ?`,
    )
    .bind(listing.listingId)
    .first<{
      matchStatus: string
      matchFingerprint: string | null
      packageId: string | null
    }>()
  const fingerprint = createMatchFingerprint(snapshot.normalizedFacts)
  const factsChanged =
    listingState?.matchFingerprint !== null &&
    listingState?.matchFingerprint !== fingerprint
  let matched =
    listingState?.matchStatus === 'matched' &&
    listingState?.packageId !== null &&
    !factsChanged
  if (!matched) {
    const match = await matchObservedListing(environment.database, {
      listingId: listing.listingId,
      observationId: identityId,
      reviewCaseId: createId(),
      expectedUpdatedAt: listing.updatedAt,
      decidedAt: listing.updatedAt + 1,
    })
    matched = match.status === 'matched'
  }
  if (!matched) {
    return { accepted: true, confirmed: false }
  }
  const listingPackage = await environment.database
    .prepare(
      `SELECT packages.unit_count AS packageUnitCount
       FROM listings
       JOIN packages ON packages.id = listings.package_id
       WHERE listings.id = ?`,
    )
    .bind(listing.listingId)
    .first<{ packageUnitCount: number }>()
  if (!listingPackage) return { accepted: true, confirmed: false }
  let confirmedOfferCount = 0
  for (const offer of snapshot.offers) {
    const existingOffer = await environment.database
      .prepare(
        `SELECT id AS offerId FROM offers
         WHERE listing_id = ? AND source_offer_key = ?`,
      )
      .bind(listing.listingId, offer.sourceOfferKey)
      .first<{ offerId: string }>()
    const price = calculateOfferPrice({
      payableAmountMinor: offer.payableAmountMinor,
      packageUnitCount: listingPackage.packageUnitCount,
      requiredPackageCount: offer.requiredPackageCount,
    })
    await ingestValidatedOfferObservation(environment.database, {
      id: createId(),
      retailerSourceId: input.sourceId,
      retailerRunId: input.runId,
      sourceListingKey: snapshot.sourceListingKey,
      sourceOfferKey: offer.sourceOfferKey,
      observedAt: input.result.observedAt,
      retrievedAt: input.result.retrievedAt,
      sourceUrl: snapshot.outboundDestination,
      rawFacts: snapshot.rawFacts,
      normalizedFacts: {
        ...snapshot.normalizedFacts,
        payableAmountMinor: offer.payableAmountMinor,
        totalUnits: price.totalUnits,
        requiredPackageCount: price.requiredPackageCount,
        eligibility: offer.eligibility,
        availability: offer.availability,
      },
      extractionMethod: snapshot.extractionMethod,
      sanitizedExcerpt: snapshot.evidenceReference.excerpt,
      issueCodes: [],
      affectedFields: [],
      outcome: 'success',
      responseIntegrityHash: input.result.responseIntegrityHash,
      sanitizedContentHash: snapshot.evidenceReference.contentHash,
      observationFormat: 1,
      adapterIdentifier: input.result.adapterIdentifier,
      listingId: listing.listingId,
      offerId: existingOffer?.offerId ?? createId(),
      payableAmountMinor: offer.payableAmountMinor,
      requiredPackageCount: offer.requiredPackageCount,
      eligibility: offer.eligibility,
      conditionText: offer.conditionText,
      availability: offer.availability,
      declaredExpiresAt: offer.declaredExpiresAt,
      outboundDestination: snapshot.outboundDestination,
    })
    confirmedOfferCount += 1
  }
  return { accepted: true, confirmed: confirmedOfferCount > 0 }
}
