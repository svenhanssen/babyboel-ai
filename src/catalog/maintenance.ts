import { z } from 'zod'

import {
  categoryCodes,
  normalizedSizeCodes,
  type CategoryCode,
  type NormalizedSizeCode,
} from '../db/domain'
import { uuidV7Schema } from '../db/validation'
import { buildProductIdentityKey, calculateOfferPrice } from './domain'
import {
  createAuditSummary,
  type SafeAuditSummary,
} from '../security/audited-mutation'
import {
  assertTrustedAdminContext,
  type AdminContext,
} from '../security/admin-boundary'

const timestampSchema = z.number().int().nonnegative()
const evidenceReferenceSchema = z.union([
  z.object({ observationId: uuidV7Schema }),
  z.object({ sourceUrl: z.url().max(2_000) }),
])
const baseMutationMetadataSchema = z.object({
  changedAt: timestampSchema,
  auditId: uuidV7Schema,
  reason: z.string().min(10).max(500),
  evidenceReference: evidenceReferenceSchema,
})
const mutationMetadataSchema = baseMutationMetadataSchema.extend({
  expectedUpdatedAt: timestampSchema,
})

type MutationMetadata = z.input<typeof mutationMetadataSchema> & {
  actor: AdminContext
}

const validateMetadata = async (
  database: Env['DB'],
  metadata: MutationMetadata,
) => {
  assertTrustedAdminContext(metadata.actor)
  const parsed = mutationMetadataSchema.parse(metadata)
  if (parsed.changedAt <= parsed.expectedUpdatedAt) {
    throw new Error('MUTATION_VERSION_INVALID')
  }
  if ('observationId' in parsed.evidenceReference) {
    const observation = await database
      .prepare('SELECT id FROM source_observations WHERE id = ?')
      .bind(parsed.evidenceReference.observationId)
      .first()
    if (!observation) throw new Error('EVIDENCE_NOT_FOUND')
  }
  return parsed
}

const summaryWithEvidence = (
  values: Record<string, unknown>,
  fields: string[],
  evidenceReference: z.output<typeof evidenceReferenceSchema>,
) => {
  const evidence =
    'observationId' in evidenceReference
      ? { observationId: evidenceReference.observationId }
      : { sourceUrl: evidenceReference.sourceUrl }
  return createAuditSummary({ ...values, ...evidence }, [
    ...fields,
    ...Object.keys(evidence),
  ])
}

const auditStatement = (
  database: Env['DB'],
  input: {
    metadata: z.output<typeof mutationMetadataSchema>
    actor: AdminContext
    action: string
    targetType: string
    targetId: string
    before: SafeAuditSummary
    after: SafeAuditSummary
    guardTable: 'offers' | 'listings' | 'products'
    guardVersion: number
  },
) =>
  database
    .prepare(
      `INSERT INTO audit_log (
        id, actor, occurred_at, action, reason, target_type, target_id,
        before_json, after_json, correlation_id
      )
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      WHERE EXISTS (
        SELECT 1 FROM ${input.guardTable} WHERE id = ? AND updated_at = ?
      )`,
    )
    .bind(
      input.metadata.auditId,
      input.actor.actorId,
      input.metadata.changedAt,
      input.action,
      input.metadata.reason,
      input.targetType,
      input.targetId,
      JSON.stringify(input.before),
      JSON.stringify(input.after),
      input.actor.requestId,
      input.targetId,
      input.guardVersion,
    )

const changedOneRow = (result: { results: unknown[] } | undefined) =>
  result?.results.length === 1

const currentVersion = async (
  database: Env['DB'],
  table: 'offers' | 'listings' | 'products',
  id: string,
) => {
  const row = await database
    .prepare(`SELECT updated_at AS updatedAt FROM ${table} WHERE id = ?`)
    .bind(id)
    .first<{ updatedAt: number }>()
  return row?.updatedAt
}

const correctOfferSchema = mutationMetadataSchema.extend({
  offerId: uuidV7Schema,
  payableAmountMinor: z.number().int().positive(),
  requiredPackageCount: z.number().int().positive(),
  eligibility: z.enum(['universal', 'restricted']),
  conditionText: z.string().min(1).max(500).nullable(),
  availability: z.enum(['available', 'unavailable', 'unknown']),
  confirmedAt: timestampSchema,
  declaredExpiresAt: timestampSchema.nullable(),
})

export async function correctOffer(
  database: Env['DB'],
  untrustedInput: z.input<typeof correctOfferSchema> & { actor: AdminContext },
) {
  const metadata = await validateMetadata(database, untrustedInput)
  const input = correctOfferSchema.parse(untrustedInput)
  if (
    (input.eligibility === 'restricted' && input.conditionText === null) ||
    (input.declaredExpiresAt !== null &&
      input.declaredExpiresAt <= input.confirmedAt)
  ) {
    throw new Error('INVALID_OFFER_CORRECTION')
  }

  const current = await database
    .prepare(
      `SELECT offers.payable_amount_minor AS payableAmountMinor,
        offers.required_package_count AS requiredPackageCount,
        offers.total_units AS totalUnits, offers.eligibility,
        offers.condition_text AS conditionText, offers.availability,
        offers.confirmed_at AS confirmedAt,
        offers.declared_expires_at AS declaredExpiresAt,
        offers.updated_at AS updatedAt, packages.unit_count AS packageUnitCount
       FROM offers
       JOIN listings ON listings.id = offers.listing_id
       JOIN packages ON packages.id = listings.package_id
       WHERE offers.id = ?`,
    )
    .bind(input.offerId)
    .first<{
      payableAmountMinor: number
      requiredPackageCount: number
      totalUnits: number
      eligibility: 'universal' | 'restricted'
      conditionText: string | null
      availability: 'available' | 'unavailable' | 'unknown'
      confirmedAt: number
      declaredExpiresAt: number | null
      updatedAt: number
      packageUnitCount: number
    }>()
  if (!current) throw new Error('OFFER_NOT_FOUND')
  if (current.updatedAt !== input.expectedUpdatedAt) {
    return { status: 'conflict' as const, version: current.updatedAt }
  }

  const price = calculateOfferPrice({
    payableAmountMinor: input.payableAmountMinor,
    packageUnitCount: current.packageUnitCount,
    requiredPackageCount: input.requiredPackageCount,
  })
  const update = database
    .prepare(
      `UPDATE offers
       SET payable_amount_minor = ?, required_package_count = ?,
         total_units = ?, unit_price_numerator = ?,
         unit_price_denominator = ?, eligibility = ?, condition_text = ?,
         availability = ?, confirmed_at = ?, declared_expires_at = ?,
         updated_at = ?
       WHERE id = ? AND updated_at = ?
       RETURNING id`,
    )
    .bind(
      input.payableAmountMinor,
      price.requiredPackageCount,
      price.totalUnits,
      price.unitPriceNumerator,
      price.unitPriceDenominator,
      input.eligibility,
      input.conditionText,
      input.availability,
      input.confirmedAt,
      input.declaredExpiresAt,
      input.changedAt,
      input.offerId,
      input.expectedUpdatedAt,
    )
  const before = createAuditSummary(current, [
    'payableAmountMinor',
    'requiredPackageCount',
    'totalUnits',
    'eligibility',
    'conditionText',
    'availability',
    'confirmedAt',
    'declaredExpiresAt',
  ])
  const after = summaryWithEvidence(
    {
      payableAmountMinor: input.payableAmountMinor,
      requiredPackageCount: price.requiredPackageCount,
      totalUnits: price.totalUnits,
      eligibility: input.eligibility,
      conditionText: input.conditionText,
      availability: input.availability,
      confirmedAt: input.confirmedAt,
      declaredExpiresAt: input.declaredExpiresAt,
    },
    [
      'payableAmountMinor',
      'requiredPackageCount',
      'totalUnits',
      'eligibility',
      'conditionText',
      'availability',
      'confirmedAt',
      'declaredExpiresAt',
    ],
    metadata.evidenceReference,
  )
  const audit = auditStatement(database, {
    metadata,
    actor: untrustedInput.actor,
    action: 'offer.correct',
    targetType: 'offer',
    targetId: input.offerId,
    before,
    after,
    guardTable: 'offers',
    guardVersion: input.changedAt,
  })
  const results = await database.batch([update, audit])
  if (!changedOneRow(results[0])) {
    return {
      status: 'conflict' as const,
      version:
        (await currentVersion(database, 'offers', input.offerId)) ??
        input.expectedUpdatedAt,
    }
  }
  return { status: 'updated' as const, version: input.changedAt }
}

const reassignListingSchema = mutationMetadataSchema.extend({
  listingId: uuidV7Schema,
  packageId: uuidV7Schema,
})

export async function reassignListing(
  database: Env['DB'],
  untrustedInput: z.input<typeof reassignListingSchema> & {
    actor: AdminContext
  },
) {
  const metadata = await validateMetadata(database, untrustedInput)
  const input = reassignListingSchema.parse(untrustedInput)
  const current = await database
    .prepare(
      `SELECT package_id AS packageId, match_status AS matchStatus,
        match_method AS matchMethod, updated_at AS updatedAt
       FROM listings WHERE id = ?`,
    )
    .bind(input.listingId)
    .first<{
      packageId: string | null
      matchStatus: string
      matchMethod: string | null
      updatedAt: number
    }>()
  if (!current) throw new Error('LISTING_NOT_FOUND')
  if (current.updatedAt !== input.expectedUpdatedAt) {
    return { status: 'conflict' as const, version: current.updatedAt }
  }
  const target = await database
    .prepare(
      `SELECT unit_count AS unitCount FROM packages
       WHERE id = ? AND lifecycle = 'active'`,
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
    .bind(input.listingId)
    .all<{
      payableAmountMinor: number
      requiredPackageCount: number
    }>()
  for (const offer of currentOffers.results) {
    calculateOfferPrice({
      payableAmountMinor: offer.payableAmountMinor,
      packageUnitCount: target.unitCount,
      requiredPackageCount: offer.requiredPackageCount,
    })
  }
  const update = database
    .prepare(
      `UPDATE listings
       SET package_id = ?, match_status = 'matched', match_method = 'manual',
         automatic_reuse_blocked = 1, last_match_decision_at = ?,
         updated_at = ?
       WHERE id = ? AND updated_at = ?
       RETURNING id`,
    )
    .bind(
      input.packageId,
      input.changedAt,
      input.changedAt,
      input.listingId,
      input.expectedUpdatedAt,
    )
  const updateOfferQuantities = database
    .prepare(
      `UPDATE offers
       SET total_units = required_package_count * ?,
         unit_price_denominator = required_package_count * ?,
         updated_at = ?
       WHERE listing_id = ?`,
    )
    .bind(target.unitCount, target.unitCount, input.changedAt, input.listingId)
  const audit = auditStatement(database, {
    metadata,
    actor: untrustedInput.actor,
    action: 'listing.reassign',
    targetType: 'listing',
    targetId: input.listingId,
    before: createAuditSummary(current, [
      'packageId',
      'matchStatus',
      'matchMethod',
    ]),
    after: summaryWithEvidence(
      {
        packageId: input.packageId,
        matchStatus: 'matched',
        matchMethod: 'manual',
      },
      ['packageId', 'matchStatus', 'matchMethod'],
      metadata.evidenceReference,
    ),
    guardTable: 'listings',
    guardVersion: input.changedAt,
  })
  const results = await database.batch([update, updateOfferQuantities, audit])
  if (!changedOneRow(results[0])) {
    return {
      status: 'conflict' as const,
      version:
        (await currentVersion(database, 'listings', input.listingId)) ??
        input.expectedUpdatedAt,
    }
  }
  return { status: 'updated' as const, version: input.changedAt }
}

const correctProductSchema = mutationMetadataSchema.extend({
  productId: uuidV7Schema,
  categoryCode: z.enum(categoryCodes),
  line: z.string().min(1).max(200).nullable(),
  variant: z.string().min(1).max(200).nullable(),
  normalizedSizeCode: z.enum(normalizedSizeCodes).nullable(),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  lifecycle: z.enum(['active', 'inactive']),
  successorProductId: uuidV7Schema.nullable(),
  mergedIntoProductId: uuidV7Schema.nullable(),
})

export async function correctProduct(
  database: Env['DB'],
  untrustedInput: z.input<typeof correctProductSchema> & {
    actor: AdminContext
  },
) {
  const metadata = await validateMetadata(database, untrustedInput)
  const input = correctProductSchema.parse(untrustedInput)
  if (
    input.successorProductId === input.productId ||
    input.mergedIntoProductId === input.productId ||
    (input.lifecycle === 'active' && input.mergedIntoProductId !== null)
  ) {
    throw new Error('INVALID_PRODUCT_CORRECTION')
  }

  const current = await database
    .prepare(
      `SELECT brands.name AS brand, products.category_code AS categoryCode,
        products.line, products.variant,
        products.normalized_size_code AS normalizedSizeCode,
        products.identity_key AS identityKey, products.slug,
        products.lifecycle,
        products.successor_product_id AS successorProductId,
        products.merged_into_product_id AS mergedIntoProductId,
        products.updated_at AS updatedAt
       FROM products
       JOIN brands ON brands.id = products.brand_id
       WHERE products.id = ?`,
    )
    .bind(input.productId)
    .first<{
      brand: string
      categoryCode: CategoryCode
      line: string | null
      variant: string | null
      normalizedSizeCode: NormalizedSizeCode | null
      identityKey: string
      slug: string
      lifecycle: 'active' | 'inactive'
      successorProductId: string | null
      mergedIntoProductId: string | null
      updatedAt: number
    }>()
  if (!current) throw new Error('PRODUCT_NOT_FOUND')
  if (current.updatedAt !== input.expectedUpdatedAt) {
    return { status: 'conflict' as const, version: current.updatedAt }
  }

  for (const relatedId of [
    input.successorProductId,
    input.mergedIntoProductId,
  ]) {
    if (relatedId === null) continue
    const related = await database
      .prepare('SELECT id FROM products WHERE id = ?')
      .bind(relatedId)
      .first()
    if (!related) throw new Error('RELATED_PRODUCT_NOT_FOUND')
  }

  const identityKey = buildProductIdentityKey({
    brand: current.brand,
    categoryCode: input.categoryCode,
    line: input.line,
    variant: input.variant,
    normalizedSizeCode: input.normalizedSizeCode,
  })
  const update = database
    .prepare(
      `UPDATE products
       SET category_code = ?, line = ?, variant = ?, normalized_size_code = ?,
         identity_key = ?, slug = ?, lifecycle = ?, successor_product_id = ?,
         merged_into_product_id = ?, updated_at = ?
       WHERE id = ? AND updated_at = ?
       RETURNING id`,
    )
    .bind(
      input.categoryCode,
      input.line,
      input.variant,
      input.normalizedSizeCode,
      identityKey,
      input.slug,
      input.lifecycle,
      input.successorProductId,
      input.mergedIntoProductId,
      input.changedAt,
      input.productId,
      input.expectedUpdatedAt,
    )
  const fields = [
    'categoryCode',
    'line',
    'variant',
    'normalizedSizeCode',
    'identityKey',
    'slug',
    'lifecycle',
    'successorProductId',
    'mergedIntoProductId',
  ]
  const audit = auditStatement(database, {
    metadata,
    actor: untrustedInput.actor,
    action: 'product.correct',
    targetType: 'product',
    targetId: input.productId,
    before: createAuditSummary(current, fields),
    after: summaryWithEvidence(
      {
        categoryCode: input.categoryCode,
        line: input.line,
        variant: input.variant,
        normalizedSizeCode: input.normalizedSizeCode,
        identityKey,
        slug: input.slug,
        lifecycle: input.lifecycle,
        successorProductId: input.successorProductId,
        mergedIntoProductId: input.mergedIntoProductId,
      },
      fields,
      metadata.evidenceReference,
    ),
    guardTable: 'products',
    guardVersion: input.changedAt,
  })
  const results = await database.batch([update, audit])
  if (!changedOneRow(results[0])) {
    return {
      status: 'conflict' as const,
      version:
        (await currentVersion(database, 'products', input.productId)) ??
        input.expectedUpdatedAt,
    }
  }
  return { status: 'updated' as const, version: input.changedAt }
}

const mergeProductsSchema = baseMutationMetadataSchema.extend({
  survivorProductId: uuidV7Schema,
  duplicateProductId: uuidV7Schema,
  expectedSurvivorUpdatedAt: timestampSchema,
  expectedDuplicateUpdatedAt: timestampSchema,
  confirmedSameProduct: z.literal(true),
})

export async function mergeProducts(
  database: Env['DB'],
  untrustedInput: z.input<typeof mergeProductsSchema> & {
    actor: AdminContext
  },
) {
  const metadata = await validateMetadata(database, {
    ...untrustedInput,
    expectedUpdatedAt: untrustedInput.expectedDuplicateUpdatedAt,
  })
  const input = mergeProductsSchema.parse(untrustedInput)
  if (input.survivorProductId === input.duplicateProductId) {
    throw new Error('PRODUCT_MERGE_SELF')
  }
  const [survivor, duplicate, count] = await Promise.all([
    database
      .prepare(
        `SELECT brand_id AS brandId, category_code AS categoryCode,
          normalized_size_code AS normalizedSizeCode, line, variant, lifecycle,
          updated_at AS updatedAt
         FROM products WHERE id = ?`,
      )
      .bind(input.survivorProductId)
      .first<{
        brandId: string
        categoryCode: CategoryCode
        normalizedSizeCode: NormalizedSizeCode | null
        line: string | null
        variant: string | null
        lifecycle: string
        updatedAt: number
      }>(),
    database
      .prepare(
        `SELECT brand_id AS brandId, category_code AS categoryCode,
          normalized_size_code AS normalizedSizeCode, line, variant, lifecycle,
          merged_into_product_id AS mergedIntoProductId,
          updated_at AS updatedAt
         FROM products WHERE id = ?`,
      )
      .bind(input.duplicateProductId)
      .first<{
        brandId: string
        categoryCode: CategoryCode
        normalizedSizeCode: NormalizedSizeCode | null
        line: string | null
        variant: string | null
        lifecycle: string
        mergedIntoProductId: string | null
        updatedAt: number
      }>(),
    database
      .prepare('SELECT COUNT(*) AS count FROM packages WHERE product_id = ?')
      .bind(input.duplicateProductId)
      .first<{ count: number }>(),
  ])
  if (!survivor || !duplicate) throw new Error('PRODUCT_NOT_FOUND')
  if (
    survivor.brandId !== duplicate.brandId ||
    survivor.categoryCode !== duplicate.categoryCode ||
    survivor.normalizedSizeCode !== duplicate.normalizedSizeCode ||
    survivor.line?.trim().toLocaleLowerCase('nl-NL') !==
      duplicate.line?.trim().toLocaleLowerCase('nl-NL') ||
    survivor.variant?.trim().toLocaleLowerCase('nl-NL') !==
      duplicate.variant?.trim().toLocaleLowerCase('nl-NL')
  ) {
    throw new Error('PRODUCT_MERGE_IDENTITY_CONFLICT')
  }
  if (
    survivor.lifecycle !== 'active' ||
    survivor.updatedAt !== input.expectedSurvivorUpdatedAt ||
    duplicate.updatedAt !== input.expectedDuplicateUpdatedAt
  ) {
    return {
      status: 'conflict' as const,
      version: Math.max(survivor.updatedAt, duplicate.updatedAt),
    }
  }

  const markDuplicate = database
    .prepare(
      `UPDATE products
       SET lifecycle = 'inactive', merged_into_product_id = ?, updated_at = ?
       WHERE id = ? AND updated_at = ?
         AND EXISTS (
           SELECT 1 FROM products
           WHERE id = ? AND lifecycle = 'active' AND updated_at = ?
         )
       RETURNING id`,
    )
    .bind(
      input.survivorProductId,
      input.changedAt,
      input.duplicateProductId,
      input.expectedDuplicateUpdatedAt,
      input.survivorProductId,
      input.expectedSurvivorUpdatedAt,
    )
  const touchSurvivor = database
    .prepare(
      `UPDATE products SET updated_at = ?
       WHERE id = ? AND updated_at = ?
         AND EXISTS (
           SELECT 1 FROM products
           WHERE id = ? AND merged_into_product_id = ? AND updated_at = ?
         )
       RETURNING id`,
    )
    .bind(
      input.changedAt,
      input.survivorProductId,
      input.expectedSurvivorUpdatedAt,
      input.duplicateProductId,
      input.survivorProductId,
      input.changedAt,
    )
  const movePackages = database
    .prepare(
      `UPDATE packages SET product_id = ?, updated_at = ?
       WHERE product_id = ?
         AND EXISTS (
           SELECT 1 FROM products
           WHERE id = ? AND merged_into_product_id = ? AND updated_at = ?
         )`,
    )
    .bind(
      input.survivorProductId,
      input.changedAt,
      input.duplicateProductId,
      input.duplicateProductId,
      input.survivorProductId,
      input.changedAt,
    )
  const audit = auditStatement(database, {
    metadata,
    actor: untrustedInput.actor,
    action: 'product.merge',
    targetType: 'product',
    targetId: input.duplicateProductId,
    before: createAuditSummary(
      {
        lifecycle: duplicate.lifecycle,
        mergedIntoProductId: duplicate.mergedIntoProductId,
      },
      ['lifecycle', 'mergedIntoProductId'],
    ),
    after: summaryWithEvidence(
      {
        lifecycle: 'inactive',
        mergedIntoProductId: input.survivorProductId,
        movedPackageCount: count?.count ?? 0,
      },
      ['lifecycle', 'mergedIntoProductId', 'movedPackageCount'],
      metadata.evidenceReference,
    ),
    guardTable: 'products',
    guardVersion: input.changedAt,
  })
  const results = await database.batch([
    markDuplicate,
    touchSurvivor,
    movePackages,
    audit,
  ])
  if (!changedOneRow(results[0]) || !changedOneRow(results[1])) {
    return {
      status: 'conflict' as const,
      version:
        (await currentVersion(
          database,
          'products',
          input.duplicateProductId,
        )) ?? input.expectedDuplicateUpdatedAt,
    }
  }
  return {
    status: 'merged' as const,
    version: input.changedAt,
    movedPackageCount: count?.count ?? 0,
  }
}
