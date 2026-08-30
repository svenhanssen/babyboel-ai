import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core'

import {
  categoryCodes,
  normalizedSizeCodes,
  type CategoryCode,
  type NormalizedSizeCode,
} from './domain'

const id = (name: string) => text(name).primaryKey()
const timestamp = (name: string) => integer(name)
const requiredTimestamp = (name: string) => timestamp(name).notNull()
const boolean = (name: string) => integer(name, { mode: 'boolean' })
const uuidV7Check = (column: AnySQLiteColumn) =>
  sql`length(${column}) = 36 AND ${column} = lower(${column}) AND ${column} GLOB '????????-????-7???-[89ab]???-????????????' AND replace(${column}, '-', '') NOT GLOB '*[^0-9a-f]*'`
const sqlTextValues = (values: readonly string[]) =>
  sql.raw(values.map((value) => `'${value.replaceAll("'", "''")}'`).join(', '))
const categoryCodeValues = sqlTextValues(categoryCodes)
const normalizedSizeCodeValues = sqlTextValues(normalizedSizeCodes)

export const retailers = sqliteTable(
  'retailers',
  {
    id: id('id'),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    lifecycle: text('lifecycle', {
      enum: ['inactive', 'active', 'paused'],
    }).notNull(),
    latestRunStatus: text('latest_run_status', {
      enum: ['running', 'complete', 'failed', 'skipped'],
    }),
    latestRunAt: timestamp('latest_run_at'),
    latestSuccessfulRunAt: timestamp('latest_successful_run_at'),
    latestErrorCode: text('latest_error_code'),
    lastAlertReason: text('last_alert_reason'),
    lastAlertAt: timestamp('last_alert_at'),
    leaseToken: text('lease_token'),
    leaseExpiresAt: timestamp('lease_expires_at'),
    createdAt: requiredTimestamp('created_at'),
    updatedAt: requiredTimestamp('updated_at'),
  },
  (table) => [
    check('retailers_id_uuidv7_check', uuidV7Check(table.id)),
    uniqueIndex('retailers_slug_unique').on(table.slug),
    index('retailers_lifecycle_name_idx').on(table.lifecycle, table.name),
    check(
      'retailers_lifecycle_check',
      sql`${table.lifecycle} IN ('inactive', 'active', 'paused')`,
    ),
    check(
      'retailers_latest_run_status_check',
      sql`${table.latestRunStatus} IS NULL OR ${table.latestRunStatus} IN ('running', 'complete', 'failed', 'skipped')`,
    ),
    check(
      'retailers_lease_pair_check',
      sql`(${table.leaseToken} IS NULL) = (${table.leaseExpiresAt} IS NULL)`,
    ),
    check(
      'retailers_alert_pair_check',
      sql`(${table.lastAlertReason} IS NULL) = (${table.lastAlertAt} IS NULL)`,
    ),
  ],
)

export const retailerSources = sqliteTable(
  'retailer_sources',
  {
    id: id('id'),
    retailerId: text('retailer_id')
      .notNull()
      .references(() => retailers.id),
    sourceKey: text('source_key').notNull(),
    acquisitionMethod: text('acquisition_method', {
      enum: ['api', 'feed', 'export'],
    }).notNull(),
    authorizationStatus: text('authorization_status', {
      enum: ['pending', 'authorized', 'review_required', 'revoked', 'expired'],
    }).notNull(),
    reviewedAt: timestamp('reviewed_at'),
    expiresAt: timestamp('expires_at'),
    retentionRuleReference: text('retention_rule_reference').notNull(),
    createdAt: requiredTimestamp('created_at'),
    updatedAt: requiredTimestamp('updated_at'),
  },
  (table) => [
    check('retailer_sources_id_uuidv7_check', uuidV7Check(table.id)),
    uniqueIndex('retailer_sources_identity_unique').on(
      table.retailerId,
      table.sourceKey,
    ),
    index('retailer_sources_authorization_idx').on(
      table.authorizationStatus,
      table.expiresAt,
    ),
    check(
      'retailer_sources_method_check',
      sql`${table.acquisitionMethod} IN ('api', 'feed', 'export')`,
    ),
    check(
      'retailer_sources_authorization_check',
      sql`${table.authorizationStatus} IN ('pending', 'authorized', 'review_required', 'revoked', 'expired')`,
    ),
  ],
)

export const brands = sqliteTable(
  'brands',
  {
    id: id('id'),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt: requiredTimestamp('created_at'),
    updatedAt: requiredTimestamp('updated_at'),
  },
  (table) => [
    check('brands_id_uuidv7_check', uuidV7Check(table.id)),
    uniqueIndex('brands_name_unique').on(table.name),
    uniqueIndex('brands_slug_unique').on(table.slug),
  ],
)

export const products = sqliteTable(
  'products',
  {
    id: id('id'),
    brandId: text('brand_id')
      .notNull()
      .references(() => brands.id),
    categoryCode: text('category_code').$type<CategoryCode>().notNull(),
    line: text('line'),
    variant: text('variant'),
    normalizedSizeCode: text(
      'normalized_size_code',
    ).$type<NormalizedSizeCode>(),
    identityKey: text('identity_key').notNull(),
    slug: text('slug').notNull(),
    lifecycle: text('lifecycle', { enum: ['active', 'inactive'] }).notNull(),
    successorProductId: text('successor_product_id').references(
      (): AnySQLiteColumn => products.id,
    ),
    mergedIntoProductId: text('merged_into_product_id').references(
      (): AnySQLiteColumn => products.id,
    ),
    createdAt: requiredTimestamp('created_at'),
    updatedAt: requiredTimestamp('updated_at'),
  },
  (table) => [
    check('products_id_uuidv7_check', uuidV7Check(table.id)),
    uniqueIndex('products_identity_unique').on(table.identityKey),
    uniqueIndex('products_slug_unique').on(table.slug),
    index('products_browse_idx').on(
      table.categoryCode,
      table.normalizedSizeCode,
      table.lifecycle,
      table.brandId,
    ),
    check(
      'products_size_applicability_check',
      sql`(${table.categoryCode} = 'wipes' AND ${table.normalizedSizeCode} IS NULL) OR (${table.categoryCode} <> 'wipes' AND ${table.normalizedSizeCode} IS NOT NULL)`,
    ),
    check(
      'products_category_check',
      sql`${table.categoryCode} IN (${categoryCodeValues})`,
    ),
    check(
      'products_normalized_size_check',
      sql`${table.normalizedSizeCode} IS NULL OR ${table.normalizedSizeCode} IN (${normalizedSizeCodeValues})`,
    ),
    check(
      'products_lifecycle_check',
      sql`${table.lifecycle} IN ('active', 'inactive')`,
    ),
    check(
      'products_successor_not_self_check',
      sql`${table.successorProductId} IS NULL OR ${table.successorProductId} <> ${table.id}`,
    ),
    check(
      'products_merge_not_self_check',
      sql`${table.mergedIntoProductId} IS NULL OR ${table.mergedIntoProductId} <> ${table.id}`,
    ),
  ],
)

export const packages = sqliteTable(
  'packages',
  {
    id: id('id'),
    productId: text('product_id')
      .notNull()
      .references(() => products.id),
    unitCount: integer('unit_count').notNull(),
    innerPackCount: integer('inner_pack_count'),
    unitsPerInnerPack: integer('units_per_inner_pack'),
    gtin: text('gtin'),
    lifecycle: text('lifecycle', { enum: ['active', 'inactive'] }).notNull(),
    createdAt: requiredTimestamp('created_at'),
    updatedAt: requiredTimestamp('updated_at'),
  },
  (table) => [
    check('packages_id_uuidv7_check', uuidV7Check(table.id)),
    uniqueIndex('packages_gtin_unique').on(table.gtin),
    index('packages_product_idx').on(table.productId, table.lifecycle),
    check('packages_unit_count_check', sql`${table.unitCount} > 0`),
    check(
      'packages_lifecycle_check',
      sql`${table.lifecycle} IN ('active', 'inactive')`,
    ),
    check(
      'packages_inner_composition_check',
      sql`(${table.innerPackCount} IS NULL AND ${table.unitsPerInnerPack} IS NULL) OR (${table.innerPackCount} > 0 AND ${table.unitsPerInnerPack} > 0 AND ${table.innerPackCount} * ${table.unitsPerInnerPack} = ${table.unitCount})`,
    ),
  ],
)

export const listings = sqliteTable(
  'listings',
  {
    id: id('id'),
    retailerId: text('retailer_id')
      .notNull()
      .references(() => retailers.id),
    packageId: text('package_id').references(() => packages.id),
    retailerSku: text('retailer_sku').notNull(),
    channel: text('channel', { enum: ['nationwide_online'] }).notNull(),
    sellerRetailerId: text('seller_retailer_id')
      .notNull()
      .references(() => retailers.id),
    sourceTitle: text('source_title').notNull(),
    outboundDestination: text('outbound_destination').notNull(),
    availability: text('availability', {
      enum: ['available', 'unavailable', 'unknown'],
    }).notNull(),
    matchStatus: text('match_status', {
      enum: ['unmatched', 'matched', 'review', 'out_of_scope'],
    }).notNull(),
    matchMethod: text('match_method', {
      enum: ['approved_listing', 'verified_gtin', 'manual'],
    }),
    matchFingerprint: text('match_fingerprint'),
    automaticReuseBlocked: boolean('automatic_reuse_blocked')
      .notNull()
      .default(false),
    lastMatchDecisionAt: timestamp('last_match_decision_at'),
    latestObservationId: text('latest_observation_id').references(
      (): AnySQLiteColumn => sourceObservations.id,
    ),
    confirmedAt: timestamp('confirmed_at'),
    missCount: integer('miss_count').notNull().default(0),
    createdAt: requiredTimestamp('created_at'),
    updatedAt: requiredTimestamp('updated_at'),
  },
  (table) => [
    check('listings_id_uuidv7_check', uuidV7Check(table.id)),
    uniqueIndex('listings_identity_unique').on(
      table.retailerId,
      table.channel,
      table.retailerSku,
    ),
    index('listings_package_status_idx').on(
      table.packageId,
      table.matchStatus,
      table.availability,
    ),
    check('listings_miss_count_check', sql`${table.missCount} >= 0`),
    check(
      'listings_availability_check',
      sql`${table.availability} IN ('available', 'unavailable', 'unknown')`,
    ),
    check(
      'listings_channel_check',
      sql`${table.channel} = 'nationwide_online'`,
    ),
    check(
      'listings_seller_check',
      sql`${table.sellerRetailerId} = ${table.retailerId}`,
    ),
    check(
      'listings_match_status_check',
      sql`${table.matchStatus} IN ('unmatched', 'matched', 'review', 'out_of_scope')`,
    ),
    check(
      'listings_match_method_check',
      sql`${table.matchMethod} IS NULL OR ${table.matchMethod} IN ('approved_listing', 'verified_gtin', 'manual')`,
    ),
    check(
      'listings_automatic_reuse_blocked_check',
      sql`${table.automaticReuseBlocked} IN (0, 1)`,
    ),
    check(
      'listings_match_coherence_check',
      sql`(${table.matchStatus} = 'matched' AND ${table.packageId} IS NOT NULL AND ${table.matchMethod} IS NOT NULL AND ${table.lastMatchDecisionAt} IS NOT NULL) OR (${table.matchStatus} <> 'matched' AND ${table.matchMethod} IS NULL)`,
    ),
  ],
)

export const offers = sqliteTable(
  'offers',
  {
    id: id('id'),
    listingId: text('listing_id')
      .notNull()
      .references(() => listings.id),
    sourceOfferKey: text('source_offer_key').notNull(),
    payableAmountMinor: integer('payable_amount_minor').notNull(),
    currency: text('currency').notNull(),
    requiredPackageCount: integer('required_package_count').notNull(),
    totalUnits: integer('total_units').notNull(),
    unitPriceNumerator: integer('unit_price_numerator').notNull(),
    unitPriceDenominator: integer('unit_price_denominator').notNull(),
    eligibility: text('eligibility', {
      enum: ['universal', 'restricted'],
    }).notNull(),
    conditionText: text('condition_text'),
    conditionJson: text('condition_json', { mode: 'json' }).$type<
      Record<string, string | number | boolean>
    >(),
    latestObservationId: text('latest_observation_id').references(
      (): AnySQLiteColumn => sourceObservations.id,
    ),
    confirmedAt: requiredTimestamp('confirmed_at'),
    declaredExpiresAt: timestamp('declared_expires_at'),
    availability: text('availability', {
      enum: ['available', 'unavailable', 'unknown'],
    }).notNull(),
    createdAt: requiredTimestamp('created_at'),
    updatedAt: requiredTimestamp('updated_at'),
  },
  (table) => [
    check('offers_id_uuidv7_check', uuidV7Check(table.id)),
    uniqueIndex('offers_lane_unique').on(table.listingId, table.sourceOfferKey),
    index('offers_current_ranking_idx').on(
      table.eligibility,
      table.availability,
      table.confirmedAt,
      table.payableAmountMinor,
    ),
    index('offers_listing_current_idx').on(
      table.listingId,
      table.availability,
      table.confirmedAt,
    ),
    check('offers_amount_check', sql`${table.payableAmountMinor} > 0`),
    check(
      'offers_quantity_check',
      sql`${table.requiredPackageCount} > 0 AND ${table.totalUnits} > 0`,
    ),
    check(
      'offers_unit_price_check',
      sql`${table.unitPriceNumerator} = ${table.payableAmountMinor} AND ${table.unitPriceDenominator} = ${table.totalUnits}`,
    ),
    check('offers_currency_check', sql`${table.currency} = 'EUR'`),
    check(
      'offers_eligibility_check',
      sql`${table.eligibility} IN ('universal', 'restricted')`,
    ),
    check(
      'offers_availability_check',
      sql`${table.availability} IN ('available', 'unavailable', 'unknown')`,
    ),
    check(
      'offers_expiry_check',
      sql`${table.declaredExpiresAt} IS NULL OR ${table.declaredExpiresAt} > ${table.confirmedAt}`,
    ),
    check(
      'offers_restricted_condition_check',
      sql`${table.eligibility} = 'universal' OR ${table.conditionText} IS NOT NULL`,
    ),
    check(
      'offers_condition_json_check',
      sql`${table.conditionJson} IS NULL OR json_valid(${table.conditionJson})`,
    ),
  ],
)

export const sourceAliases = sqliteTable(
  'source_aliases',
  {
    id: id('id'),
    retailerSourceId: text('retailer_source_id')
      .notNull()
      .references(() => retailerSources.id),
    field: text('field', { enum: ['category', 'size'] }).notNull(),
    rawValue: text('raw_value').notNull(),
    categoryCode: text('category_code').$type<CategoryCode>(),
    normalizedSizeCode: text(
      'normalized_size_code',
    ).$type<NormalizedSizeCode>(),
    active: boolean('active').notNull(),
    evidenceNote: text('evidence_note').notNull(),
    createdAt: requiredTimestamp('created_at'),
    updatedAt: requiredTimestamp('updated_at'),
  },
  (table) => [
    check('source_aliases_id_uuidv7_check', uuidV7Check(table.id)),
    uniqueIndex('source_aliases_identity_unique').on(
      table.retailerSourceId,
      table.field,
      table.rawValue,
    ),
    check(
      'source_aliases_value_check',
      sql`(${table.field} = 'category' AND ${table.categoryCode} IS NOT NULL AND ${table.normalizedSizeCode} IS NULL) OR (${table.field} = 'size' AND ${table.categoryCode} IS NULL AND ${table.normalizedSizeCode} IS NOT NULL)`,
    ),
    check(
      'source_aliases_field_check',
      sql`${table.field} IN ('category', 'size')`,
    ),
    check(
      'source_aliases_category_check',
      sql`${table.categoryCode} IS NULL OR ${table.categoryCode} IN (${categoryCodeValues})`,
    ),
    check(
      'source_aliases_size_check',
      sql`${table.normalizedSizeCode} IS NULL OR ${table.normalizedSizeCode} IN (${normalizedSizeCodeValues})`,
    ),
    check('source_aliases_active_check', sql`${table.active} IN (0, 1)`),
  ],
)

export const retailerRuns = sqliteTable(
  'retailer_runs',
  {
    id: id('id'),
    retailerId: text('retailer_id')
      .notNull()
      .references(() => retailers.id),
    origin: text('origin', { enum: ['scheduled', 'manual'] }).notNull(),
    startedAt: requiredTimestamp('started_at'),
    finishedAt: timestamp('finished_at'),
    status: text('status', {
      enum: ['running', 'complete', 'failed', 'skipped'],
    }).notNull(),
    fetchedCount: integer('fetched_count').notNull().default(0),
    acceptedCount: integer('accepted_count').notNull().default(0),
    rejectedCount: integer('rejected_count').notNull().default(0),
    confirmedCount: integer('confirmed_count').notNull().default(0),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    fullTraversal: boolean('full_traversal').notNull().default(false),
  },
  (table) => [
    check('retailer_runs_id_uuidv7_check', uuidV7Check(table.id)),
    index('retailer_runs_retailer_started_idx').on(
      table.retailerId,
      table.startedAt,
    ),
    check(
      'retailer_runs_counts_check',
      sql`${table.fetchedCount} >= 0 AND ${table.acceptedCount} >= 0 AND ${table.rejectedCount} >= 0 AND ${table.confirmedCount} >= 0`,
    ),
    check(
      'retailer_runs_origin_check',
      sql`${table.origin} IN ('scheduled', 'manual')`,
    ),
    check(
      'retailer_runs_status_check',
      sql`${table.status} IN ('running', 'complete', 'failed', 'skipped')`,
    ),
    check(
      'retailer_runs_full_traversal_check',
      sql`${table.fullTraversal} IN (0, 1)`,
    ),
    check(
      'retailer_runs_completion_check',
      sql`(${table.status} = 'running' AND ${table.finishedAt} IS NULL) OR (${table.status} <> 'running' AND ${table.finishedAt} IS NOT NULL)`,
    ),
    check(
      'retailer_runs_traversal_check',
      sql`${table.fullTraversal} = 0 OR ${table.status} = 'complete'`,
    ),
  ],
)

export const evidenceArtifacts = sqliteTable(
  'evidence_artifacts',
  {
    id: id('id'),
    retailerSourceId: text('retailer_source_id')
      .notNull()
      .references(() => retailerSources.id),
    r2Key: text('r2_key').notNull(),
    contentHash: text('content_hash').notNull(),
    artifactType: text('artifact_type', {
      enum: ['raw_response', 'sanitized_model_input', 'model_output'],
    }).notNull(),
    accessClass: text('access_class', { enum: ['private'] }).notNull(),
    storedAt: requiredTimestamp('stored_at'),
    retentionDeadline: requiredTimestamp('retention_deadline'),
    deletedAt: timestamp('deleted_at'),
  },
  (table) => [
    check('evidence_artifacts_id_uuidv7_check', uuidV7Check(table.id)),
    uniqueIndex('evidence_artifacts_r2_key_unique').on(table.r2Key),
    index('evidence_artifacts_retention_idx').on(
      table.deletedAt,
      table.retentionDeadline,
    ),
    check(
      'evidence_artifacts_retention_check',
      sql`${table.retentionDeadline} >= ${table.storedAt}`,
    ),
    check(
      'evidence_artifacts_type_check',
      sql`${table.artifactType} IN ('raw_response', 'sanitized_model_input', 'model_output')`,
    ),
    check(
      'evidence_artifacts_access_check',
      sql`${table.accessClass} = 'private'`,
    ),
  ],
)

export const sourceObservations = sqliteTable(
  'source_observations',
  {
    id: id('id'),
    retailerSourceId: text('retailer_source_id')
      .notNull()
      .references(() => retailerSources.id),
    retailerRunId: text('retailer_run_id')
      .notNull()
      .references(() => retailerRuns.id),
    listingId: text('listing_id').references(() => listings.id),
    offerId: text('offer_id').references(() => offers.id),
    evidenceArtifactId: text('evidence_artifact_id').references(
      () => evidenceArtifacts.id,
    ),
    sourceListingKey: text('source_listing_key').notNull(),
    sourceOfferKey: text('source_offer_key').notNull().default('default'),
    observedAt: requiredTimestamp('observed_at'),
    retrievedAt: requiredTimestamp('retrieved_at'),
    sourceUrl: text('source_url').notNull(),
    rawFactsJson: text('raw_facts_json', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull(),
    normalizedFactsJson: text('normalized_facts_json', { mode: 'json' })
      .$type<Record<string, unknown>>()
      .notNull(),
    extractionMethod: text('extraction_method', {
      enum: ['api', 'json_ld', 'metadata', 'selector', 'llm'],
    }).notNull(),
    sanitizedExcerpt: text('sanitized_excerpt'),
    issueCodesJson: text('issue_codes_json', { mode: 'json' })
      .$type<string[]>()
      .notNull(),
    affectedFieldsJson: text('affected_fields_json', { mode: 'json' })
      .$type<string[]>()
      .notNull(),
    outcome: text('outcome', {
      enum: ['success', 'incomplete', 'invalid', 'fetch_failed'],
    }).notNull(),
    responseIntegrityHash: text('response_integrity_hash').notNull(),
    sanitizedContentHash: text('sanitized_content_hash'),
    observationFormat: integer('observation_format').notNull(),
    adapterIdentifier: text('adapter_identifier').notNull(),
  },
  (table) => [
    check('source_observations_id_uuidv7_check', uuidV7Check(table.id)),
    uniqueIndex('source_observations_natural_unique').on(
      table.retailerSourceId,
      table.retailerRunId,
      table.sourceListingKey,
      table.sourceOfferKey,
      table.responseIntegrityHash,
      table.outcome,
    ),
    index('source_observations_listing_time_idx').on(
      table.listingId,
      table.observedAt,
    ),
    index('source_observations_offer_time_idx').on(
      table.offerId,
      table.observedAt,
    ),
    check(
      'source_observations_time_check',
      sql`${table.retrievedAt} >= ${table.observedAt}`,
    ),
    check(
      'source_observations_format_check',
      sql`${table.observationFormat} > 0`,
    ),
    check(
      'source_observations_method_check',
      sql`${table.extractionMethod} IN ('api', 'json_ld', 'metadata', 'selector', 'llm')`,
    ),
    check(
      'source_observations_outcome_check',
      sql`${table.outcome} IN ('success', 'incomplete', 'invalid', 'fetch_failed')`,
    ),
    check(
      'source_observations_json_check',
      sql`json_valid(${table.rawFactsJson}) AND json_valid(${table.normalizedFactsJson}) AND json_valid(${table.issueCodesJson}) AND json_valid(${table.affectedFieldsJson})`,
    ),
  ],
)

export const reviewCases = sqliteTable(
  'review_cases',
  {
    id: id('id'),
    retailerId: text('retailer_id')
      .notNull()
      .references(() => retailers.id),
    listingId: text('listing_id')
      .notNull()
      .references(() => listings.id),
    latestObservationId: text('latest_observation_id').references(
      () => sourceObservations.id,
    ),
    uncertaintyType: text('uncertainty_type').notNull(),
    status: text('status', { enum: ['open', 'closed'] }).notNull(),
    blocksPublication: boolean('blocks_publication').notNull(),
    caseVersion: integer('case_version').notNull(),
    occurrenceCount: integer('occurrence_count').notNull(),
    notes: text('notes'),
    closureOutcome: text('closure_outcome'),
    openedAt: requiredTimestamp('opened_at'),
    updatedAt: requiredTimestamp('updated_at'),
    closedAt: timestamp('closed_at'),
  },
  (table) => [
    check('review_cases_id_uuidv7_check', uuidV7Check(table.id)),
    index('review_cases_queue_idx').on(
      table.status,
      table.blocksPublication,
      table.openedAt,
    ),
    uniqueIndex('review_cases_logical_unique').on(
      table.retailerId,
      table.listingId,
      table.uncertaintyType,
    ),
    check(
      'review_cases_counts_check',
      sql`${table.caseVersion} > 0 AND ${table.occurrenceCount} > 0`,
    ),
    check(
      'review_cases_status_check',
      sql`${table.status} IN ('open', 'closed')`,
    ),
    check(
      'review_cases_blocks_publication_check',
      sql`${table.blocksPublication} IN (0, 1)`,
    ),
    check(
      'review_cases_closure_check',
      sql`(${table.status} = 'open' AND ${table.closedAt} IS NULL AND ${table.closureOutcome} IS NULL) OR (${table.status} = 'closed' AND ${table.closedAt} IS NOT NULL AND ${table.closureOutcome} IS NOT NULL)`,
    ),
  ],
)

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: id('id'),
    actor: text('actor').notNull(),
    occurredAt: requiredTimestamp('occurred_at'),
    action: text('action').notNull(),
    reason: text('reason').notNull(),
    targetType: text('target_type').notNull(),
    targetId: text('target_id').notNull(),
    beforeJson: text('before_json', { mode: 'json' }).$type<
      Record<string, unknown>
    >(),
    afterJson: text('after_json', { mode: 'json' }).$type<
      Record<string, unknown>
    >(),
    priorAuditId: text('prior_audit_id').references(
      (): AnySQLiteColumn => auditLog.id,
    ),
    correlationId: text('correlation_id').notNull(),
  },
  (table) => [
    check('audit_log_id_uuidv7_check', uuidV7Check(table.id)),
    index('audit_log_target_time_idx').on(
      table.targetType,
      table.targetId,
      table.occurredAt,
    ),
    check(
      'audit_log_change_check',
      sql`${table.beforeJson} IS NOT NULL OR ${table.afterJson} IS NOT NULL`,
    ),
    check(
      'audit_log_json_check',
      sql`(${table.beforeJson} IS NULL OR json_valid(${table.beforeJson})) AND (${table.afterJson} IS NULL OR json_valid(${table.afterJson}))`,
    ),
  ],
)

export const systemChecks = sqliteTable(
  'system_checks',
  {
    checkKey: text('check_key').primaryKey(),
    status: text('status', { enum: ['ok', 'warning', 'failed'] }).notNull(),
    checkedAt: requiredTimestamp('checked_at'),
    safeDetailCode: text('safe_detail_code'),
    lastAlertReason: text('last_alert_reason'),
    lastAlertAt: timestamp('last_alert_at'),
  },
  (table) => [
    check(
      'system_checks_status_check',
      sql`${table.status} IN ('ok', 'warning', 'failed')`,
    ),
    check(
      'system_checks_alert_pair_check',
      sql`(${table.lastAlertReason} IS NULL) = (${table.lastAlertAt} IS NULL)`,
    ),
  ],
)
