import { z } from 'zod'

import type { MatchDecision } from './domain'

const uuidV7Schema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  )
const timestampSchema = z.number().int().nonnegative()

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
      `SELECT id
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
    .first<{ id: string }>()

export async function recordSourceObservation(
  database: Env['DB'],
  untrustedInput: SourceObservationInput,
) {
  const input = sourceObservationSchema.parse(untrustedInput)
  const existing = await findObservation(database, input)
  if (existing) return { id: existing.id, inserted: false as const }

  try {
    await database
      .prepare(
        `INSERT INTO source_observations (
          id, retailer_source_id, retailer_run_id, listing_id, offer_id,
          evidence_artifact_id, source_listing_key, source_offer_key,
          observed_at, retrieved_at, source_url, raw_facts_json,
          normalized_facts_json, extraction_method, sanitized_excerpt,
          issue_codes_json, affected_fields_json, outcome,
          response_integrity_hash, sanitized_content_hash,
          observation_format, adapter_identifier
        ) VALUES (
          ?, ?, ?, NULL, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?
        )`,
      )
      .bind(
        input.id,
        input.retailerSourceId,
        input.retailerRunId,
        input.sourceListingKey,
        input.sourceOfferKey,
        input.observedAt,
        input.retrievedAt,
        input.sourceUrl,
        JSON.stringify(input.rawFacts),
        JSON.stringify(input.normalizedFacts),
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
      .run()
    return { id: input.id, inserted: true as const }
  } catch (error) {
    const raced = await findObservation(database, input)
    if (raced) return { id: raced.id, inserted: false as const }
    throw error
  }
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

export async function applyListingMatchDecision(
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
               confirmed_at = ?, updated_at = ?
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
