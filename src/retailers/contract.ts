import { z } from 'zod'

import { calculateOfferPrice, matchFactsSchema } from '../catalog/domain'

const timestampSchema = z.number().int().nonnegative()
const issueCodeSchema = z.string().min(1).max(100)
const sha256Schema = z.string().regex(/^sha256:[0-9a-f]{64}$/)

const outboundDestinationSchema = z
  .url()
  .max(2_000)
  .refine((value) => {
    const url = new URL(value)
    return (
      url.protocol === 'https:' &&
      url.username === '' &&
      url.password === '' &&
      url.hash === ''
    )
  }, 'OUTBOUND_DESTINATION_REJECTED')

export const retailerAdapterOfferSchema = z
  .object({
    sourceOfferKey: z.string().min(1).max(500),
    payableAmountMinor: z.number().int().positive(),
    currency: z.literal('EUR'),
    requiredPackageCount: z.number().int().positive(),
    eligibility: z.enum(['universal', 'restricted']),
    conditionText: z.string().min(1).max(500).nullable(),
    availability: z.enum(['available', 'unavailable', 'unknown']),
    declaredExpiresAt: timestampSchema.nullable(),
  })
  .superRefine((offer, context) => {
    if (offer.eligibility === 'restricted' && offer.conditionText === null) {
      context.addIssue({
        code: 'custom',
        message: 'RESTRICTED_OFFER_REQUIRES_CONDITION',
        path: ['conditionText'],
      })
    }
  })

export const retailerAdapterSnapshotSchema = z.object({
  sourceListingKey: z.string().min(1).max(500),
  sellerKey: z.string().min(1).max(200),
  channel: z.literal('nationwide_online'),
  sourceTitle: z.string().min(1).max(500),
  outboundDestination: outboundDestinationSchema.nullable(),
  availability: z.enum(['available', 'unavailable', 'unknown']),
  observedAt: timestampSchema,
  rawFacts: z.record(z.string(), z.unknown()),
  normalizedFacts: matchFactsSchema,
  extractionMethod: z.literal('api'),
  outcome: z.enum(['success', 'incomplete', 'invalid']),
  issueCodes: z.array(issueCodeSchema).max(100),
  affectedFields: z.array(z.string().min(1).max(100)).max(100),
  evidenceReference: z.object({
    contentHash: sha256Schema,
    excerpt: z.string().min(1).max(2_000).nullable(),
  }),
  offers: z.array(retailerAdapterOfferSchema).max(20),
})

export const retailerAdapterResultSchema = z
  .object({
    adapterIdentifier: z.string().min(1).max(200),
    contractVersion: z.literal(1),
    sourceKey: z.string().min(1).max(200),
    sourceHost: z.string().min(1).max(253),
    retrievedAt: timestampSchema,
    observedAt: timestampSchema,
    responseIntegrityHash: sha256Schema,
    traversal: z.enum(['complete', 'incomplete']),
    issueCodes: z.array(issueCodeSchema).max(100),
    snapshots: z.array(retailerAdapterSnapshotSchema).max(5_000),
  })
  .superRefine((result, context) => {
    if (result.retrievedAt < result.observedAt) {
      context.addIssue({
        code: 'custom',
        message: 'OBSERVATION_TIME_INVALID',
        path: ['retrievedAt'],
      })
    }
    for (const [index, snapshot] of result.snapshots.entries()) {
      if (snapshot.observedAt > result.retrievedAt) {
        context.addIssue({
          code: 'custom',
          message: 'OBSERVATION_TIME_INVALID',
          path: ['snapshots', index, 'observedAt'],
        })
      }
      if (snapshot.outcome === 'success' && snapshot.issueCodes.length > 0) {
        context.addIssue({
          code: 'custom',
          message: 'SUCCESS_SNAPSHOT_HAS_ISSUES',
          path: ['snapshots', index, 'issueCodes'],
        })
      }
      if (snapshot.outcome === 'success') {
        if (snapshot.outboundDestination === null) {
          context.addIssue({
            code: 'custom',
            message: 'OUTBOUND_DESTINATION_REQUIRED',
            path: ['snapshots', index, 'outboundDestination'],
          })
        }
        for (const [offerIndex, offer] of snapshot.offers.entries()) {
          if (snapshot.normalizedFacts.unitCount === null) {
            context.addIssue({
              code: 'custom',
              message: 'PACKAGE_QUANTITY_REQUIRED',
              path: ['snapshots', index, 'normalizedFacts', 'unitCount'],
            })
            break
          }
          try {
            calculateOfferPrice({
              payableAmountMinor: offer.payableAmountMinor,
              packageUnitCount: snapshot.normalizedFacts.unitCount,
              requiredPackageCount: offer.requiredPackageCount,
            })
          } catch {
            context.addIssue({
              code: 'custom',
              message: 'INVALID_OFFER_PRICE',
              path: ['snapshots', index, 'offers', offerIndex],
            })
          }
        }
      }
    }
  })

export type RetailerAdapterResult = z.output<typeof retailerAdapterResultSchema>
export type RetailerAdapterSnapshot = z.output<
  typeof retailerAdapterSnapshotSchema
>

export function parseRetailerAdapterResult(
  untrustedInput: unknown,
): RetailerAdapterResult {
  return retailerAdapterResultSchema.parse(untrustedInput)
}
