import { z } from 'zod'

import { categoryCodes, normalizedSizeCodes } from '../db/domain'
import { uuidV7Schema } from '../db/validation'
import {
  calculateOfferPrice,
  createMatchFingerprint,
  decideListingMatch,
  type MatchDecision,
  type MatchFacts,
  type PackageMatchCandidate,
} from './domain'

const timestampSchema = z.number().int().nonnegative()
const matchFactsSchema = z.object({
  brand: z.string().min(1).max(200).nullable(),
  categoryCode: z.enum(categoryCodes).nullable(),
  normalizedSizeCode: z.enum(normalizedSizeCodes).nullable(),
  line: z.string().min(1).max(200).nullable(),
  variant: z.string().min(1).max(200).nullable(),
  gtin: z
    .string()
    .regex(/^(?:\d{8}|\d{12,14})$/)
    .nullable(),
  unitCount: z.number().int().positive().nullable(),
  innerPackCount: z.number().int().positive().nullable(),
  unitsPerInnerPack: z.number().int().positive().nullable(),
})

const sourceObservationSchema = z
  .object({
    id: uuidV7Schema,
    retailerSourceId: uuidV7Schema,
    retailerRunId: uuidV7Schema,
    sourceListingKey: z.string().min(1).max(500),
    sourceOfferKey: z.string().min(1).max(500).default('default'),
    observedAt: timestampSchema,
    retrievedAt: timestampSchema,
    sourceUrl: z.url().max(2_000),
    rawFacts: z.record(z.string(), z.unknown()),
    normalizedFacts: z.record(z.string(), z.unknown()),
    extractionMethod: z.enum(['api', 'json_ld', 'metadata', 'selector', 'llm']),
    sanitizedExcerpt: z.string().max(2_000).nullable().default(null),
    issueCodes: z.array(z.string().min(1).max(100)).max(100),
    affectedFields: z.array(z.string().min(1).max(100)).max(100),
    outcome: z.enum(['success', 'incomplete', 'invalid', 'fetch_failed']),
    responseIntegrityHash: z.string().min(1).max(500),
    sanitizedContentHash: z.string().min(1).max(500).nullable().default(null),
    observationFormat: z.number().int().positive(),
    adapterIdentifier: z.string().min(1).max(200),
  })
  .refine(({ retrievedAt, observedAt }) => retrievedAt >= observedAt, {
    message: 'OBSERVATION_TIME_INVALID',
  })

type SourceObservationInput = z.input<typeof sourceObservationSchema>

const findObservation = (
  database: Env['DB'],
  input: Pick<
    z.output<typeof sourceObservationSchema>,
    | 'retailerSourceId'
    | 'sourceListingKey'
    | 'sourceOfferKey'
    | 'responseIntegrityHash'
    | 'outcome'
  >,
) =>
  database
    .prepare(
      `SELECT id, offer_id AS offerId
       FROM source_observations
       WHERE retailer_source_id = ?
         AND source_listing_key = ?
         AND source_offer_key = ?
         AND response_integrity_hash = ?
         AND outcome = ?`,
    )
    .bind(
      input.retailerSourceId,
      input.sourceListingKey,
      input.sourceOfferKey,
      input.responseIntegrityHash,
      input.outcome,
    )
    .first<{ id: string; offerId: string | null }>()

const prepareSourceObservationInsert = (
  database: Env['DB'],
  input: z.output<typeof sourceObservationSchema>,
  links: {
    listingId: string | null
    offerId: string | null
    normalizedFacts?: Record<string, unknown>
  },
) =>
  database
    .prepare(
      `INSERT INTO source_observations (
        id, retailer_source_id, retailer_run_id, listing_id, offer_id,
        evidence_artifact_id, source_listing_key, source_offer_key,
        observed_at, retrieved_at, source_url, raw_facts_json,
        normalized_facts_json, extraction_method, sanitized_excerpt,
        issue_codes_json, affected_fields_json, outcome,
        response_integrity_hash, sanitized_content_hash,
        observation_format, adapter_identifier
      ) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?)`,
    )
    .bind(
      input.id,
      input.retailerSourceId,
      input.retailerRunId,
      links.listingId,
      links.offerId,
      input.sourceListingKey,
      input.sourceOfferKey,
      input.observedAt,
      input.retrievedAt,
      input.sourceUrl,
      JSON.stringify(input.rawFacts),
      JSON.stringify(links.normalizedFacts ?? input.normalizedFacts),
      input.extractionMethod,
      input.sanitizedExcerpt,
      JSON.stringify(input.issueCodes),
      JSON.stringify(input.affectedFields),
      input.outcome,
      input.responseIntegrityHash,
      input.sanitizedContentHash,
      input.observationFormat,
      input.adapterIdentifier,
    )

export async function recordSourceObservation(
  database: Env['DB'],
  untrustedInput: SourceObservationInput,
) {
  const input = sourceObservationSchema.parse(untrustedInput)
  const existing = await findObservation(database, input)
  if (existing) return { id: existing.id, inserted: false as const }

  try {
    await prepareSourceObservationInsert(database, input, {
      listingId: null,
      offerId: null,
    }).run()
    return { id: input.id, inserted: true as const }
  } catch (error) {
    const raced = await findObservation(database, input)
    if (raced) return { id: raced.id, inserted: false as const }
    throw error
  }
}

const validatedOfferObservationSchema = sourceObservationSchema.extend({
  listingId: uuidV7Schema,
  offerId: uuidV7Schema,
  payableAmountMinor: z.number().int().positive(),
  requiredPackageCount: z.number().int().positive(),
  eligibility: z.enum(['universal', 'restricted']),
  conditionText: z.string().min(1).max(500).nullable(),
  availability: z.enum(['available', 'unavailable', 'unknown']),
  declaredExpiresAt: timestampSchema.nullable(),
  outboundDestination: z.url().max(2_000),
})

export async function ingestValidatedOfferObservation(
  database: Env['DB'],
  untrustedInput: z.input<typeof validatedOfferObservationSchema>,
) {
  const input = validatedOfferObservationSchema.parse(untrustedInput)
  if (
    (input.eligibility === 'restricted' && input.conditionText === null) ||
    (input.declaredExpiresAt !== null &&
      input.declaredExpiresAt <= input.observedAt)
  ) {
    throw new Error('INVALID_OFFER_OBSERVATION')
  }
  const duplicate = await findObservation(database, input)
  if (duplicate) {
    return {
      status: 'unchanged' as const,
      offerId: duplicate.offerId ?? input.offerId,
    }
  }

  const listing = await database
    .prepare(
      `SELECT packages.unit_count AS packageUnitCount,
        listings.match_status AS matchStatus, products.id AS productId
       FROM listings
       JOIN packages ON packages.id = listings.package_id
       JOIN products ON products.id = packages.product_id
       WHERE listings.id = ? AND packages.lifecycle = 'active'
         AND products.lifecycle = 'active'`,
    )
    .bind(input.listingId)
    .first<{
      packageUnitCount: number
      matchStatus: string
      productId: string
    }>()
  if (!listing || listing.matchStatus !== 'matched') {
    throw new Error('LISTING_NOT_PUBLISHABLE')
  }
  const price = calculateOfferPrice({
    payableAmountMinor: input.payableAmountMinor,
    packageUnitCount: listing.packageUnitCount,
    requiredPackageCount: input.requiredPackageCount,
  })
  const existingOffer = await database
    .prepare(
      `SELECT id FROM offers
       WHERE listing_id = ? AND source_offer_key = ?`,
    )
    .bind(input.listingId, input.sourceOfferKey)
    .first<{ id: string }>()
  if (existingOffer && existingOffer.id !== input.offerId) {
    throw new Error('OFFER_IDENTITY_CONFLICT')
  }

  const writeOffer = existingOffer
    ? database
        .prepare(
          `UPDATE offers
           SET payable_amount_minor = ?, required_package_count = ?,
             total_units = ?, unit_price_numerator = ?,
             unit_price_denominator = ?, eligibility = ?, condition_text = ?,
             confirmed_at = ?, declared_expires_at = ?, availability = ?,
             updated_at = ?
           WHERE id = ?`,
        )
        .bind(
          input.payableAmountMinor,
          price.requiredPackageCount,
          price.totalUnits,
          price.unitPriceNumerator,
          price.unitPriceDenominator,
          input.eligibility,
          input.conditionText,
          input.observedAt,
          input.declaredExpiresAt,
          input.availability,
          input.observedAt,
          input.offerId,
        )
    : database
        .prepare(
          `INSERT INTO offers (
            id, listing_id, source_offer_key, payable_amount_minor, currency,
            required_package_count, total_units, unit_price_numerator,
            unit_price_denominator, eligibility, condition_text, confirmed_at,
            declared_expires_at, availability, created_at, updated_at
          ) VALUES (?, ?, ?, ?, 'EUR', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          input.offerId,
          input.listingId,
          input.sourceOfferKey,
          input.payableAmountMinor,
          price.requiredPackageCount,
          price.totalUnits,
          price.unitPriceNumerator,
          price.unitPriceDenominator,
          input.eligibility,
          input.conditionText,
          input.observedAt,
          input.declaredExpiresAt,
          input.availability,
          input.observedAt,
          input.observedAt,
        )
  const insertObservation = prepareSourceObservationInsert(database, input, {
    listingId: input.listingId,
    offerId: input.offerId,
    normalizedFacts: {
      ...input.normalizedFacts,
      productId: listing.productId,
    },
  })
  const linkOffer = database
    .prepare(
      `UPDATE offers SET latest_observation_id = ?
       WHERE id = ?`,
    )
    .bind(input.id, input.offerId)
  const confirmListing = database
    .prepare(
      `UPDATE listings
       SET latest_observation_id = ?, confirmed_at = ?, availability = ?,
         outbound_destination = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(
      input.id,
      input.observedAt,
      input.availability,
      input.outboundDestination,
      input.observedAt,
      input.listingId,
    )

  await database.batch([
    writeOffer,
    insertObservation,
    linkOffer,
    confirmListing,
  ])
  return {
    status: existingOffer ? ('updated' as const) : ('created' as const),
    offerId: input.offerId,
  }
}

const quarantinedOfferObservationSchema = sourceObservationSchema.extend({
  listingId: uuidV7Schema,
  offerId: uuidV7Schema.nullable().default(null),
  reviewCaseId: uuidV7Schema,
  uncertaintyType: z.enum(['price_conflict', 'price_incomplete']),
})

export async function quarantineOfferObservation(
  database: Env['DB'],
  untrustedInput: z.input<typeof quarantinedOfferObservationSchema>,
) {
  const input = quarantinedOfferObservationSchema.parse(untrustedInput)
  const duplicate = await findObservation(database, input)
  if (duplicate) {
    return { status: 'unchanged' as const, observationId: duplicate.id }
  }
  const listing = await database
    .prepare('SELECT retailer_id AS retailerId FROM listings WHERE id = ?')
    .bind(input.listingId)
    .first<{ retailerId: string }>()
  if (!listing) throw new Error('LISTING_NOT_FOUND')
  if (input.offerId !== null) {
    const offer = await database
      .prepare('SELECT id FROM offers WHERE id = ? AND listing_id = ?')
      .bind(input.offerId, input.listingId)
      .first()
    if (!offer) throw new Error('OFFER_NOT_FOUND')
  }

  const insertObservation = prepareSourceObservationInsert(database, input, {
    listingId: input.listingId,
    offerId: input.offerId,
  })
  const statements = [insertObservation]
  if (input.offerId !== null) {
    statements.push(
      database
        .prepare(
          `UPDATE offers
           SET availability = 'unknown', latest_observation_id = ?,
             updated_at = ?
           WHERE id = ?`,
        )
        .bind(input.id, input.observedAt, input.offerId),
    )
  }
  statements.push(
    database
      .prepare(
        `INSERT INTO review_cases (
          id, retailer_id, listing_id, latest_observation_id,
          uncertainty_type, status, blocks_publication, case_version,
          occurrence_count, notes, opened_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'open', 1, 1, 1, ?, ?, ?)
        ON CONFLICT(retailer_id, listing_id, uncertainty_type) DO UPDATE SET
          latest_observation_id = excluded.latest_observation_id,
          status = 'open',
          blocks_publication = 1,
          case_version = review_cases.case_version + 1,
          occurrence_count = review_cases.occurrence_count + 1,
          notes = excluded.notes,
          updated_at = excluded.updated_at,
          closed_at = NULL,
          closure_outcome = NULL`,
      )
      .bind(
        input.reviewCaseId,
        listing.retailerId,
        input.listingId,
        input.id,
        input.uncertaintyType,
        input.issueCodes.join(', '),
        input.observedAt,
        input.observedAt,
      ),
  )
  await database.batch(statements)
  return { status: 'review' as const, observationId: input.id }
}

const matchDecisionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('matched'),
    packageId: uuidV7Schema,
    method: z.enum(['approved_listing', 'verified_gtin']),
    firstAutomaticMatchAudit: z.boolean(),
  }),
  z.object({
    kind: z.literal('review'),
    uncertaintyType: z.enum([
      'unmatched_or_ambiguous',
      'contradiction',
      'unknown_package',
    ]),
    reasons: z.array(z.string().min(1).max(100)).min(1).max(20),
  }),
])

const listingMatchInputSchema = z
  .object({
    listingId: uuidV7Schema,
    observationId: uuidV7Schema,
    reviewCaseId: uuidV7Schema,
    expectedUpdatedAt: timestampSchema,
    decidedAt: timestampSchema,
    fingerprint: z.string().min(1).max(2_000),
    decision: matchDecisionSchema,
    blockAutomaticReuse: z.boolean().default(false),
  })
  .refine(({ decidedAt, expectedUpdatedAt }) => decidedAt > expectedUpdatedAt, {
    message: 'MATCH_VERSION_INVALID',
  })

type ListingMatchInput = Omit<
  z.input<typeof listingMatchInputSchema>,
  'decision'
> & {
  decision: MatchDecision
}

const parseStoredFingerprint = (fingerprint: string | null) => {
  if (fingerprint === null) return null
  try {
    const parsed: unknown = JSON.parse(fingerprint)
    const result = matchFactsSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

const observedListingMatchSchema = z.object({
  listingId: uuidV7Schema,
  observationId: uuidV7Schema,
  reviewCaseId: uuidV7Schema,
  expectedUpdatedAt: timestampSchema,
  decidedAt: timestampSchema,
  blockAutomaticReuse: z.boolean().default(false),
})

export async function matchObservedListing(
  database: Env['DB'],
  untrustedInput: z.input<typeof observedListingMatchSchema>,
) {
  const input = observedListingMatchSchema.parse(untrustedInput)
  const listing = await database
    .prepare(
      `SELECT package_id AS packageId, match_method AS matchMethod,
        match_fingerprint AS matchFingerprint,
        automatic_reuse_blocked AS automaticReuseBlocked,
        retailer_id AS retailerId, retailer_sku AS retailerSku
       FROM listings WHERE id = ?`,
    )
    .bind(input.listingId)
    .first<{
      packageId: string | null
      matchMethod: string | null
      matchFingerprint: string | null
      automaticReuseBlocked: number
      retailerId: string
      retailerSku: string
    }>()
  if (!listing) throw new Error('LISTING_NOT_FOUND')
  const sourceObservation = await database
    .prepare(
      `SELECT source_observations.normalized_facts_json AS normalizedFacts,
        source_observations.extraction_method AS extractionMethod,
        source_observations.source_listing_key AS sourceListingKey,
        retailer_sources.retailer_id AS retailerId,
        retailer_sources.acquisition_method AS acquisitionMethod,
        retailer_sources.authorization_status AS authorizationStatus
       FROM source_observations
       JOIN retailer_sources
         ON retailer_sources.id = source_observations.retailer_source_id
       WHERE source_observations.id = ?`,
    )
    .bind(input.observationId)
    .first<{
      normalizedFacts: string
      extractionMethod: string
      sourceListingKey: string
      retailerId: string
      acquisitionMethod: string
      authorizationStatus: string
    }>()
  if (
    !sourceObservation ||
    sourceObservation.retailerId !== listing.retailerId ||
    sourceObservation.sourceListingKey !== listing.retailerSku
  ) {
    throw new Error('OBSERVATION_LISTING_MISMATCH')
  }
  let normalizedFacts: unknown
  try {
    normalizedFacts = JSON.parse(sourceObservation.normalizedFacts)
  } catch {
    throw new Error('OBSERVATION_FACTS_INVALID')
  }
  const observed = matchFactsSchema.parse(normalizedFacts)
  const verifiedGtin =
    observed.gtin !== null &&
    sourceObservation.authorizationStatus === 'authorized' &&
    (sourceObservation.acquisitionMethod === 'feed' ||
      sourceObservation.acquisitionMethod === 'api') &&
    sourceObservation.extractionMethod === 'api'
      ? {
          value: observed.gtin,
          provenance: 'authorized_feed' as const,
        }
      : undefined

  const fingerprintFacts = parseStoredFingerprint(listing.matchFingerprint)
  const approved =
    listing.packageId !== null &&
    fingerprintFacts !== null &&
    (listing.matchMethod === 'manual' ||
      listing.matchMethod === 'approved_listing')
      ? {
          packageId: listing.packageId,
          fingerprint: fingerprintFacts,
          automaticReuseBlocked: listing.automaticReuseBlocked === 1,
        }
      : null
  const catalogRows = await database
    .prepare(
      `SELECT packages.id AS packageId, packages.lifecycle,
        brands.name AS brand, products.category_code AS categoryCode,
        products.normalized_size_code AS normalizedSizeCode,
        products.line, products.variant, packages.gtin,
        packages.unit_count AS unitCount,
        packages.inner_pack_count AS innerPackCount,
        packages.units_per_inner_pack AS unitsPerInnerPack
       FROM packages
       JOIN products ON products.id = packages.product_id
       JOIN brands ON brands.id = products.brand_id
       WHERE products.lifecycle = 'active'`,
    )
    .all<{
      packageId: string
      lifecycle: 'active' | 'inactive'
      brand: string
      categoryCode: MatchFacts['categoryCode']
      normalizedSizeCode: MatchFacts['normalizedSizeCode']
      line: string | null
      variant: string | null
      gtin: string | null
      unitCount: number
      innerPackCount: number | null
      unitsPerInnerPack: number | null
    }>()
  const verifiedGtinPackages: PackageMatchCandidate[] = catalogRows.results.map(
    ({ packageId, lifecycle, ...facts }) => ({
      packageId,
      facts,
      active: lifecycle === 'active',
    }),
  )
  const decision = decideListingMatch({
    observed,
    approved,
    verifiedGtin,
    verifiedGtinPackages,
  })

  return applyListingMatchDecision(database, {
    listingId: input.listingId,
    observationId: input.observationId,
    reviewCaseId: input.reviewCaseId,
    expectedUpdatedAt: input.expectedUpdatedAt,
    decidedAt: input.decidedAt,
    fingerprint: createMatchFingerprint(observed),
    decision,
    blockAutomaticReuse: input.blockAutomaticReuse,
  })
}

async function applyListingMatchDecision(
  database: Env['DB'],
  untrustedInput: ListingMatchInput,
) {
  const input = listingMatchInputSchema.parse(untrustedInput)
  const listing = await database
    .prepare(
      `SELECT retailer_id AS retailerId, latest_observation_id AS observationId,
        updated_at AS updatedAt
       FROM listings
       WHERE id = ?`,
    )
    .bind(input.listingId)
    .first<{
      retailerId: string
      observationId: string | null
      updatedAt: number
    }>()

  if (!listing) throw new Error('LISTING_NOT_FOUND')
  if (listing.observationId === input.observationId) {
    return { status: 'unchanged' as const, version: listing.updatedAt }
  }
  if (listing.updatedAt !== input.expectedUpdatedAt) {
    return { status: 'conflict' as const, version: listing.updatedAt }
  }

  const update =
    input.decision.kind === 'matched'
      ? database
          .prepare(
            `UPDATE listings
             SET package_id = ?, match_status = 'matched', match_method = ?,
               match_fingerprint = ?, automatic_reuse_blocked = 0,
               last_match_decision_at = ?, latest_observation_id = ?,
               updated_at = ?
             WHERE id = ? AND updated_at = ?
             RETURNING id`,
          )
          .bind(
            input.decision.packageId,
            input.decision.method,
            input.fingerprint,
            input.decidedAt,
            input.observationId,
            input.decidedAt,
            input.listingId,
            input.expectedUpdatedAt,
          )
      : database
          .prepare(
            `UPDATE listings
             SET package_id = NULL, match_status = 'review', match_method = NULL,
               match_fingerprint = ?, automatic_reuse_blocked = ?,
               last_match_decision_at = ?, latest_observation_id = ?,
               availability = 'unknown', updated_at = ?
             WHERE id = ? AND updated_at = ?
             RETURNING id`,
          )
          .bind(
            input.fingerprint,
            input.blockAutomaticReuse ? 1 : 0,
            input.decidedAt,
            input.observationId,
            input.decidedAt,
            input.listingId,
            input.expectedUpdatedAt,
          )

  const reviewType =
    input.decision.kind === 'review'
      ? input.decision.uncertaintyType
      : input.decision.firstAutomaticMatchAudit
        ? 'first_automatic_match_audit'
        : null
  const review =
    reviewType === null
      ? null
      : database
          .prepare(
            `INSERT INTO review_cases (
              id, retailer_id, listing_id, latest_observation_id,
              uncertainty_type, status, blocks_publication, case_version,
              occurrence_count, notes, opened_at, updated_at
            )
            SELECT ?, ?, ?, ?, ?, 'open', ?, 1, 1, ?, ?, ?
            WHERE EXISTS (
              SELECT 1 FROM listings
              WHERE id = ? AND updated_at = ? AND latest_observation_id = ?
            )
            ON CONFLICT(retailer_id, listing_id, uncertainty_type) DO UPDATE SET
              latest_observation_id = excluded.latest_observation_id,
              status = 'open',
              blocks_publication = excluded.blocks_publication,
              case_version = review_cases.case_version + 1,
              occurrence_count = review_cases.occurrence_count + 1,
              notes = excluded.notes,
              updated_at = excluded.updated_at,
              closed_at = NULL,
              closure_outcome = NULL`,
          )
          .bind(
            input.reviewCaseId,
            listing.retailerId,
            input.listingId,
            input.observationId,
            reviewType,
            input.decision.kind === 'review' ? 1 : 0,
            input.decision.kind === 'review'
              ? input.decision.reasons.join(', ')
              : 'First automatic verified-GTIN association',
            input.decidedAt,
            input.decidedAt,
            input.listingId,
            input.decidedAt,
            input.observationId,
          )

  const results = await database.batch(review ? [update, review] : [update])
  const changed = results[0]?.results.length === 1
  if (!changed) {
    const current = await database
      .prepare('SELECT updated_at AS updatedAt FROM listings WHERE id = ?')
      .bind(input.listingId)
      .first<{ updatedAt: number }>()
    return {
      status: 'conflict' as const,
      version: current?.updatedAt ?? input.expectedUpdatedAt,
    }
  }

  return {
    status:
      input.decision.kind === 'matched'
        ? ('matched' as const)
        : ('review' as const),
    version: input.decidedAt,
  }
}
