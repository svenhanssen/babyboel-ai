import { z } from 'zod'

import { uuidV7Schema } from '../db/validation'
import { createAuditSummary } from '../security/audited-mutation'
import {
  assertTrustedAdminContext,
  type AdminContext,
} from '../security/admin-boundary'
import { calculateOfferPrice } from './domain'
import { matchFactsSchema } from './domain'
import { findListingMatchCandidates } from './service'

const timestampSchema = z.number().int().nonnegative()
const reviewStatusSchema = z.enum(['open', 'closed'])
const maximumPageSize = 50

const reviewFiltersSchema = z.object({
  status: reviewStatusSchema.default('open'),
  retailerId: uuidV7Schema.optional(),
  uncertaintyType: z.string().trim().min(1).max(100).optional(),
  search: z.string().trim().max(200).default(''),
  offset: z.number().int().min(0).default(0),
  limit: z.number().int().min(1).max(maximumPageSize).default(24),
})

export type ReviewFilters = z.input<typeof reviewFiltersSchema>

const escapeLike = (value: string) =>
  value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')

export async function listReviewCases(
  database: Env['DB'],
  untrustedFilters: ReviewFilters = {},
) {
  const filters = reviewFiltersSchema.parse(untrustedFilters)
  const conditions = ['review_cases.status = ?']
  const values: unknown[] = [filters.status]
  if (filters.retailerId) {
    conditions.push('review_cases.retailer_id = ?')
    values.push(filters.retailerId)
  }
  if (filters.uncertaintyType) {
    conditions.push('review_cases.uncertainty_type = ?')
    values.push(filters.uncertaintyType)
  }
  if (filters.search) {
    conditions.push(`(
      listings.retailer_sku LIKE ? ESCAPE '\\' OR
      listings.source_title LIKE ? ESCAPE '\\' OR
      review_cases.id LIKE ? ESCAPE '\\'
    )`)
    const pattern = `%${escapeLike(filters.search)}%`
    values.push(pattern, pattern, pattern)
  }
  const where = conditions.join(' AND ')
  const base = `FROM review_cases
    JOIN retailers ON retailers.id = review_cases.retailer_id
    JOIN listings ON listings.id = review_cases.listing_id
    WHERE ${where}`
  const [rows, count, facets] = await Promise.all([
    database
      .prepare(
        `SELECT review_cases.id, review_cases.listing_id AS listingId,
          review_cases.uncertainty_type AS uncertaintyType,
          review_cases.status, review_cases.blocks_publication AS blocksPublication,
          review_cases.case_version AS caseVersion,
          review_cases.occurrence_count AS occurrenceCount,
          review_cases.opened_at AS openedAt,
          review_cases.updated_at AS updatedAt,
          retailers.id AS retailerId, retailers.name AS retailerName,
          listings.retailer_sku AS retailerSku,
          listings.source_title AS sourceTitle,
          listings.match_status AS matchStatus
         ${base}
         ORDER BY review_cases.blocks_publication DESC,
           review_cases.opened_at ASC, review_cases.id ASC
         LIMIT ? OFFSET ?`,
      )
      .bind(...values, filters.limit, filters.offset)
      .all<{
        id: string
        listingId: string
        uncertaintyType: string
        status: 'open' | 'closed'
        blocksPublication: number
        caseVersion: number
        occurrenceCount: number
        openedAt: number
        updatedAt: number
        retailerId: string
        retailerName: string
        retailerSku: string
        sourceTitle: string
        matchStatus: string
      }>(),
    database
      .prepare(`SELECT COUNT(*) AS count ${base}`)
      .bind(...values)
      .first<{ count: number }>(),
    database
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM review_cases WHERE status = 'open') AS openCount,
          (SELECT COUNT(*) FROM review_cases WHERE status = 'closed') AS closedCount`,
      )
      .first<{ openCount: number; closedCount: number }>(),
  ])

  return {
    cases: rows.results.map((row) => ({
      ...row,
      blocksPublication: row.blocksPublication === 1,
    })),
    total: count?.count ?? 0,
    counts: facets ?? { openCount: 0, closedCount: 0 },
    offset: filters.offset,
    limit: filters.limit,
  }
}

const reviewCaseInputSchema = z.object({ caseId: uuidV7Schema })

type SafeFact = string | number | boolean | null

const parseJson = (value: unknown): unknown => {
  if (typeof value !== 'string') return value
  try {
    return JSON.parse(value) as unknown
  } catch {
    return undefined
  }
}

const safeObject = (value: unknown): Record<string, SafeFact> => {
  value = parseJson(value)
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: Record<string, SafeFact> = {}
  for (const [key, item] of Object.entries(
    value as Record<string, unknown>,
  ).slice(0, 30)) {
    if (
      /(cookie|credential|password|secret|token|assertion|headers|html)/i.test(
        key,
      )
    ) {
      continue
    }
    if (
      item === null ||
      typeof item === 'boolean' ||
      typeof item === 'number' ||
      (typeof item === 'string' && item.length <= 500)
    ) {
      result[key] = item
    }
  }
  return result
}

export async function getReviewCase(
  database: Env['DB'],
  untrustedInput: z.input<typeof reviewCaseInputSchema>,
) {
  const input = reviewCaseInputSchema.parse(untrustedInput)
  const review = await database
    .prepare(
      `SELECT review_cases.id, review_cases.listing_id AS listingId,
        review_cases.latest_observation_id AS latestObservationId,
        review_cases.uncertainty_type AS uncertaintyType,
        review_cases.status, review_cases.blocks_publication AS blocksPublication,
        review_cases.case_version AS caseVersion,
        review_cases.occurrence_count AS occurrenceCount, review_cases.notes,
        review_cases.closure_outcome AS closureOutcome,
        review_cases.opened_at AS openedAt,
        review_cases.updated_at AS updatedAt,
        review_cases.closed_at AS closedAt,
        retailers.id AS retailerId, retailers.name AS retailerName,
        listings.package_id AS packageId,
        listings.retailer_sku AS retailerSku,
        listings.source_title AS sourceTitle,
        listings.outbound_destination AS outboundDestination,
        listings.availability AS listingAvailability,
        listings.match_status AS matchStatus,
        listings.match_method AS matchMethod,
        listings.updated_at AS listingUpdatedAt,
        source_observations.observed_at AS observedAt,
        source_observations.source_url AS sourceUrl,
        source_observations.raw_facts_json AS rawFacts,
        source_observations.normalized_facts_json AS normalizedFacts,
        source_observations.sanitized_excerpt AS sanitizedExcerpt,
        source_observations.issue_codes_json AS issueCodes,
        source_observations.affected_fields_json AS affectedFields,
        source_observations.outcome AS observationOutcome,
        evidence_artifacts.id AS evidenceArtifactId,
        evidence_artifacts.deleted_at AS evidenceDeletedAt
       FROM review_cases
       JOIN retailers ON retailers.id = review_cases.retailer_id
       JOIN listings ON listings.id = review_cases.listing_id
       LEFT JOIN source_observations
         ON source_observations.id = review_cases.latest_observation_id
       LEFT JOIN evidence_artifacts
         ON evidence_artifacts.id = source_observations.evidence_artifact_id
       WHERE review_cases.id = ?`,
    )
    .bind(input.caseId)
    .first<{
      id: string
      listingId: string
      latestObservationId: string | null
      uncertaintyType: string
      status: 'open' | 'closed'
      blocksPublication: number
      caseVersion: number
      occurrenceCount: number
      notes: string | null
      closureOutcome: string | null
      openedAt: number
      updatedAt: number
      closedAt: number | null
      retailerId: string
      retailerName: string
      packageId: string | null
      retailerSku: string
      sourceTitle: string
      outboundDestination: string
      listingAvailability: string
      matchStatus: string
      matchMethod: string | null
      listingUpdatedAt: number
      observedAt: number | null
      sourceUrl: string | null
      rawFacts: unknown
      normalizedFacts: unknown
      sanitizedExcerpt: string | null
      issueCodes: string[] | null
      affectedFields: string[] | null
      observationOutcome: string | null
      evidenceArtifactId: string | null
      evidenceDeletedAt: number | null
    }>()
  if (!review) return null

  const rawFacts = safeObject(review.rawFacts)
  const normalizedFacts = safeObject(review.normalizedFacts)
  const candidateFacts = matchFactsSchema.safeParse({
    brand: normalizedFacts.brand ?? rawFacts.brand ?? null,
    categoryCode: normalizedFacts.categoryCode ?? rawFacts.categoryCode ?? null,
    normalizedSizeCode:
      normalizedFacts.normalizedSizeCode ?? rawFacts.normalizedSizeCode ?? null,
    line: normalizedFacts.line ?? rawFacts.line ?? null,
    variant: normalizedFacts.variant ?? rawFacts.variant ?? null,
    gtin: normalizedFacts.gtin ?? rawFacts.gtin ?? null,
    unitCount: normalizedFacts.unitCount ?? rawFacts.unitCount ?? null,
    innerPackCount:
      normalizedFacts.innerPackCount ?? rawFacts.innerPackCount ?? null,
    unitsPerInnerPack:
      normalizedFacts.unitsPerInnerPack ?? rawFacts.unitsPerInnerPack ?? null,
  })
  const exactCandidates = candidateFacts.success
    ? await findListingMatchCandidates(database, candidateFacts.data)
    : []
  const candidateExplanations = new Map(
    exactCandidates.map((candidate) => [candidate.packageId, candidate]),
  )
  const candidateIds = [
    ...new Set([
      ...(review.packageId ? [review.packageId] : []),
      ...exactCandidates.map((candidate) => candidate.packageId),
    ]),
  ].slice(0, 3)

  const [packages, observations, audits] = await Promise.all([
    candidateIds.length === 0
      ? Promise.resolve({ results: [] })
      : database
          .prepare(
            `SELECT packages.id AS packageId, packages.gtin,
          packages.unit_count AS unitCount,
          packages.inner_pack_count AS innerPackCount,
          packages.units_per_inner_pack AS unitsPerInnerPack,
          brands.name AS brand, products.id AS productId,
          products.category_code AS categoryCode,
          products.normalized_size_code AS normalizedSizeCode,
          products.line, products.variant
         FROM packages
         JOIN products ON products.id = packages.product_id
         JOIN brands ON brands.id = products.brand_id
         WHERE packages.lifecycle = 'active' AND products.lifecycle = 'active'
           AND packages.id IN (${candidateIds.map(() => '?').join(', ')})
         ORDER BY
           CASE WHEN packages.id = ? THEN 0 ELSE 1 END,
           brands.name, products.line, products.variant, packages.unit_count`,
          )
          .bind(...candidateIds, review.packageId)
          .all<{
            packageId: string
            gtin: string | null
            unitCount: number
            innerPackCount: number | null
            unitsPerInnerPack: number | null
            brand: string
            productId: string
            categoryCode: string
            normalizedSizeCode: string | null
            line: string | null
            variant: string | null
          }>(),
    database
      .prepare(
        `SELECT id, observed_at AS occurredAt, outcome,
          issue_codes_json AS issueCodes, sanitized_excerpt AS summary
         FROM source_observations
         WHERE listing_id = ?
         ORDER BY observed_at DESC, id DESC LIMIT 20`,
      )
      .bind(review.listingId)
      .all<{
        id: string
        occurredAt: number
        outcome: string
        issueCodes: string[]
        summary: string | null
      }>(),
    database
      .prepare(
        `SELECT id, occurred_at AS occurredAt, action, actor, reason,
          before_json AS beforeValues, after_json AS afterValues
         FROM audit_log
         WHERE (target_type = 'review_case' AND target_id = ?)
            OR (target_type = 'listing' AND target_id = ?)
         ORDER BY occurred_at DESC, id DESC LIMIT 20`,
      )
      .bind(review.id, review.listingId)
      .all<{
        id: string
        occurredAt: number
        action: string
        actor: string
        reason: string
        beforeValues: Record<string, SafeFact> | null
        afterValues: Record<string, SafeFact> | null
      }>(),
  ])

  return {
    ...review,
    blocksPublication: review.blocksPublication === 1,
    rawFacts,
    normalizedFacts,
    issueCodes: z
      .array(z.string())
      .catch([])
      .parse(parseJson(review.issueCodes)),
    affectedFields: z
      .array(z.string())
      .catch([])
      .parse(parseJson(review.affectedFields)),
    evidenceAvailable:
      review.latestObservationId !== null &&
      (review.evidenceArtifactId === null || review.evidenceDeletedAt === null),
    candidates: packages.results.map((candidate) => ({
      ...candidate,
      agreeingFields:
        candidateExplanations.get(candidate.packageId)?.agreeingFields ?? [],
      missingCriticalFacts:
        candidateExplanations.get(candidate.packageId)?.missingCriticalFacts ??
        [],
      conflictReasons: [],
      currentAssociation: candidate.packageId === review.packageId,
    })),
    activity: [
      ...observations.results.map((entry) => ({
        kind: 'observation' as const,
        ...entry,
      })),
      ...audits.results.map((entry) => ({
        kind: 'decision' as const,
        ...entry,
      })),
    ]
      .sort((left, right) => Number(right.occurredAt) - Number(left.occurredAt))
      .slice(0, 20),
  }
}

const resolveReviewSchema = z.object({
  caseId: uuidV7Schema,
  expectedCaseVersion: z.number().int().positive(),
  expectedListingUpdatedAt: timestampSchema,
  changedAt: timestampSchema,
  auditId: uuidV7Schema,
  action: z.enum([
    'associate',
    'out_of_scope',
    'mark_unavailable',
    'false_alarm',
    'ignore',
    'defer',
  ]),
  packageId: uuidV7Schema.optional(),
  reason: z.string().trim().min(10).max(500),
})

export async function resolveReviewCase(
  database: Env['DB'],
  untrustedInput: z.input<typeof resolveReviewSchema> & { actor: AdminContext },
) {
  assertTrustedAdminContext(untrustedInput.actor)
  const input = resolveReviewSchema.parse(untrustedInput)
  const current = await database
    .prepare(
      `SELECT review_cases.status, review_cases.case_version AS caseVersion,
        review_cases.listing_id AS listingId,
        review_cases.latest_observation_id AS observationId,
        listings.updated_at AS listingUpdatedAt,
        listings.package_id AS packageId,
        listings.match_status AS matchStatus,
        listings.availability
       FROM review_cases
       JOIN listings ON listings.id = review_cases.listing_id
       WHERE review_cases.id = ?`,
    )
    .bind(input.caseId)
    .first<{
      status: 'open' | 'closed'
      caseVersion: number
      listingId: string
      observationId: string | null
      listingUpdatedAt: number
      packageId: string | null
      matchStatus: string
      availability: string
    }>()
  if (!current) throw new Error('REVIEW_NOT_FOUND')
  if (current.status === 'closed')
    return { status: 'already_resolved' as const }
  if (
    current.caseVersion !== input.expectedCaseVersion ||
    current.listingUpdatedAt !== input.expectedListingUpdatedAt
  ) {
    return {
      status: 'conflict' as const,
      caseVersion: current.caseVersion,
      listingVersion: current.listingUpdatedAt,
    }
  }
  if (input.changedAt <= current.listingUpdatedAt) {
    throw new Error('MUTATION_VERSION_INVALID')
  }

  if (input.action === 'defer') {
    const update = database
      .prepare(
        `UPDATE review_cases
         SET notes = ?, case_version = case_version + 1, updated_at = ?
         WHERE id = ? AND status = 'open' AND case_version = ?
         RETURNING id`,
      )
      .bind(
        input.reason,
        input.changedAt,
        input.caseId,
        input.expectedCaseVersion,
      )
    const after = createAuditSummary(
      {
        status: 'open',
        outcome: 'deferred',
        caseVersion: input.expectedCaseVersion + 1,
      },
      ['status', 'outcome', 'caseVersion'],
    )
    const audit = database
      .prepare(
        `INSERT INTO audit_log (
          id, actor, occurred_at, action, reason, target_type, target_id,
          before_json, after_json, correlation_id
        ) SELECT ?, ?, ?, 'review.defer', ?, 'review_case', ?, ?, ?, ?
          WHERE EXISTS (SELECT 1 FROM review_cases WHERE id = ? AND updated_at = ?)`,
      )
      .bind(
        input.auditId,
        untrustedInput.actor.actorId,
        input.changedAt,
        input.reason,
        input.caseId,
        JSON.stringify(createAuditSummary({ status: 'open' }, ['status'])),
        JSON.stringify(after),
        untrustedInput.actor.requestId,
        input.caseId,
        input.changedAt,
      )
    const result = await database.batch([update, audit])
    if (result[0]?.results.length !== 1) {
      return {
        status: 'conflict' as const,
        caseVersion: current.caseVersion,
        listingVersion: current.listingUpdatedAt,
      }
    }
    return {
      status: 'deferred' as const,
      caseVersion: input.expectedCaseVersion + 1,
    }
  }

  let listingUpdate: ReturnType<typeof database.prepare> | null = null
  let offerUpdate: ReturnType<typeof database.prepare> | null = null
  let outcome: string
  let listingAfter: Record<string, unknown>

  if (input.action === 'associate') {
    if (!input.packageId) throw new Error('PACKAGE_REQUIRED')
    const target = await database
      .prepare(
        `SELECT packages.unit_count AS unitCount
         FROM packages JOIN products ON products.id = packages.product_id
         WHERE packages.id = ? AND packages.lifecycle = 'active'
           AND products.lifecycle = 'active'`,
      )
      .bind(input.packageId)
      .first<{ unitCount: number }>()
    if (!target) throw new Error('PACKAGE_NOT_FOUND')
    const currentOffers = await database
      .prepare(
        `SELECT payable_amount_minor AS payableAmountMinor,
          required_package_count AS requiredPackageCount
         FROM offers WHERE listing_id = ?`,
      )
      .bind(current.listingId)
      .all<{ payableAmountMinor: number; requiredPackageCount: number }>()
    for (const offer of currentOffers.results) {
      calculateOfferPrice({
        payableAmountMinor: offer.payableAmountMinor,
        packageUnitCount: target.unitCount,
        requiredPackageCount: offer.requiredPackageCount,
      })
    }
    listingUpdate = database
      .prepare(
        `UPDATE listings SET package_id = ?, match_status = 'matched',
          match_method = 'manual', automatic_reuse_blocked = 1,
          last_match_decision_at = ?, updated_at = ?
         WHERE id = ? AND updated_at = ? RETURNING id`,
      )
      .bind(
        input.packageId,
        input.changedAt,
        input.changedAt,
        current.listingId,
        input.expectedListingUpdatedAt,
      )
    offerUpdate = database
      .prepare(
        `UPDATE offers SET total_units = required_package_count * ?,
          unit_price_denominator = required_package_count * ?, updated_at = ?
         WHERE listing_id = ?`,
      )
      .bind(
        target.unitCount,
        target.unitCount,
        input.changedAt,
        current.listingId,
      )
    outcome = 'associated'
    listingAfter = {
      packageId: input.packageId,
      matchStatus: 'matched',
      matchMethod: 'manual',
    }
  } else if (input.action === 'out_of_scope' || input.action === 'ignore') {
    listingUpdate = database
      .prepare(
        `UPDATE listings SET package_id = NULL, match_status = 'out_of_scope',
          match_method = NULL, automatic_reuse_blocked = 1,
          availability = 'unavailable', last_match_decision_at = ?, updated_at = ?
         WHERE id = ? AND updated_at = ? RETURNING id`,
      )
      .bind(
        input.changedAt,
        input.changedAt,
        current.listingId,
        input.expectedListingUpdatedAt,
      )
    offerUpdate = database
      .prepare(
        `UPDATE offers SET availability = 'unavailable', updated_at = ? WHERE listing_id = ?`,
      )
      .bind(input.changedAt, current.listingId)
    outcome = input.action === 'ignore' ? 'ignored' : 'out_of_scope'
    listingAfter = {
      packageId: null,
      matchStatus: 'out_of_scope',
      availability: 'unavailable',
    }
  } else if (input.action === 'mark_unavailable') {
    listingUpdate = database
      .prepare(
        `UPDATE listings SET availability = 'unavailable', updated_at = ?
         WHERE id = ? AND updated_at = ? RETURNING id`,
      )
      .bind(input.changedAt, current.listingId, input.expectedListingUpdatedAt)
    offerUpdate = database
      .prepare(
        `UPDATE offers SET availability = 'unavailable', updated_at = ? WHERE listing_id = ?`,
      )
      .bind(input.changedAt, current.listingId)
    outcome = 'marked_unavailable'
    listingAfter = {
      availability: 'unavailable',
      matchStatus: current.matchStatus,
    }
  } else {
    outcome = 'false_alarm'
    listingAfter = {
      packageId: current.packageId,
      matchStatus: current.matchStatus,
      availability: current.availability,
    }
  }

  const close = database
    .prepare(
      `UPDATE review_cases SET status = 'closed', closure_outcome = ?,
        closed_at = ?, updated_at = ?, case_version = case_version + 1
       WHERE id = ? AND status = 'open' AND case_version = ? RETURNING id`,
    )
    .bind(
      outcome,
      input.changedAt,
      input.changedAt,
      input.caseId,
      input.expectedCaseVersion,
    )
  const before = createAuditSummary(
    {
      status: current.status,
      packageId: current.packageId,
      matchStatus: current.matchStatus,
      availability: current.availability,
    },
    ['status', 'packageId', 'matchStatus', 'availability'],
  )
  const after = createAuditSummary(
    {
      status: 'closed',
      outcome,
      ...listingAfter,
      observationId: current.observationId,
    },
    ['status', 'outcome', ...Object.keys(listingAfter), 'observationId'],
  )
  const audit = database
    .prepare(
      `INSERT INTO audit_log (
        id, actor, occurred_at, action, reason, target_type, target_id,
        before_json, after_json, correlation_id
      ) SELECT ?, ?, ?, ?, ?, 'review_case', ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM review_cases WHERE id = ? AND updated_at = ?)`,
    )
    .bind(
      input.auditId,
      untrustedInput.actor.actorId,
      input.changedAt,
      `review.${input.action}`,
      input.reason,
      input.caseId,
      JSON.stringify(before),
      JSON.stringify(after),
      untrustedInput.actor.requestId,
      input.caseId,
      input.changedAt,
    )
  const statements = [
    ...(listingUpdate ? [listingUpdate] : []),
    ...(offerUpdate ? [offerUpdate] : []),
    close,
    audit,
  ]
  const results = await database.batch(statements)
  const guarded = listingUpdate ? results[0] : results[0]
  if (guarded?.results.length !== 1) {
    return {
      status: 'conflict' as const,
      caseVersion: current.caseVersion,
      listingVersion: current.listingUpdatedAt,
    }
  }
  return {
    status: 'resolved' as const,
    outcome,
    caseVersion: input.expectedCaseVersion + 1,
  }
}

const catalogSearchSchema = z.object({
  search: z.string().trim().max(200).default(''),
  entityType: z.enum(['all', 'product', 'package', 'listing']).default('all'),
  lifecycle: z.enum(['all', 'active', 'inactive']).default('all'),
  limit: z.number().int().min(1).max(50).default(30),
})

type CatalogRow = {
  id: string
  entityType: 'product' | 'package' | 'listing'
  brand: string
  line: string | null
  variant: string | null
  identifier: string
  lifecycle: 'active' | 'inactive'
  updatedAt: number
}

export async function searchCatalog(
  database: Env['DB'],
  untrustedInput: z.input<typeof catalogSearchSchema> = {},
) {
  const input = catalogSearchSchema.parse(untrustedInput)
  const pattern = `%${escapeLike(input.search)}%`
  const include = (entity: 'product' | 'package' | 'listing') =>
    input.entityType === 'all' || input.entityType === entity
  const products = include('product')
    ? await database
        .prepare(
          `SELECT products.id, 'product' AS entityType, brands.name AS brand,
            products.line, products.variant, products.slug AS identifier,
            products.lifecycle, products.updated_at AS updatedAt
           FROM products JOIN brands ON brands.id = products.brand_id
           WHERE (? = '' OR brands.name LIKE ? ESCAPE '\\'
             OR products.line LIKE ? ESCAPE '\\' OR products.variant LIKE ? ESCAPE '\\'
             OR products.id LIKE ? ESCAPE '\\')
             AND (? = 'all' OR products.lifecycle = ?)
           ORDER BY brands.name, products.line, products.variant LIMIT ?`,
        )
        .bind(
          input.search,
          pattern,
          pattern,
          pattern,
          pattern,
          input.lifecycle,
          input.lifecycle,
          input.limit,
        )
        .all<CatalogRow>()
    : { results: [] as CatalogRow[] }
  const packageRows = include('package')
    ? await database
        .prepare(
          `SELECT packages.id, 'package' AS entityType, brands.name AS brand,
            products.line, products.variant,
            coalesce(packages.gtin, CAST(packages.unit_count AS TEXT) || ' units') AS identifier,
            packages.lifecycle, packages.updated_at AS updatedAt
           FROM packages JOIN products ON products.id = packages.product_id
           JOIN brands ON brands.id = products.brand_id
           WHERE (? = '' OR packages.gtin LIKE ? ESCAPE '\\'
             OR packages.id LIKE ? ESCAPE '\\' OR brands.name LIKE ? ESCAPE '\\'
             OR products.line LIKE ? ESCAPE '\\')
             AND (? = 'all' OR packages.lifecycle = ?)
           ORDER BY brands.name, products.line, packages.unit_count LIMIT ?`,
        )
        .bind(
          input.search,
          pattern,
          pattern,
          pattern,
          pattern,
          input.lifecycle,
          input.lifecycle,
          input.limit,
        )
        .all<CatalogRow>()
    : { results: [] as CatalogRow[] }
  const listingRows = include('listing')
    ? await database
        .prepare(
          `SELECT listings.id, 'listing' AS entityType, retailers.name AS brand,
            listings.source_title AS line, NULL AS variant,
            listings.retailer_sku AS identifier,
            CASE WHEN listings.match_status = 'out_of_scope' THEN 'inactive' ELSE 'active' END AS lifecycle,
            listings.updated_at AS updatedAt
           FROM listings JOIN retailers ON retailers.id = listings.retailer_id
           WHERE (? = '' OR listings.retailer_sku LIKE ? ESCAPE '\\'
             OR listings.source_title LIKE ? ESCAPE '\\'
             OR listings.id LIKE ? ESCAPE '\\')
             AND (? = 'all' OR
               CASE WHEN listings.match_status = 'out_of_scope' THEN 'inactive' ELSE 'active' END = ?)
           ORDER BY retailers.name, listings.source_title LIMIT ?`,
        )
        .bind(
          input.search,
          pattern,
          pattern,
          pattern,
          input.lifecycle,
          input.lifecycle,
          input.limit,
        )
        .all<CatalogRow>()
    : { results: [] as CatalogRow[] }
  return {
    products: products.results,
    packages: packageRows.results,
    listings: listingRows.results,
  }
}
