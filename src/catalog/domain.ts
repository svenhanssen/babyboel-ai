import {
  categoryCodes,
  currentOfferFreshnessMilliseconds,
  normalizedSizeCodes,
  type CategoryCode,
  type NormalizedSizeCode,
} from '../db/domain'

type NullableFact = string | number | null

export type MatchFacts = {
  brand: string | null
  categoryCode: CategoryCode | null
  normalizedSizeCode: NormalizedSizeCode | null
  line: string | null
  variant: string | null
  gtin: string | null
  unitCount: number | null
  innerPackCount: number | null
  unitsPerInnerPack: number | null
}

export type PackageMatchCandidate = {
  packageId: string
  facts: MatchFacts
  active: boolean
}

export type MatchDecision =
  | {
      kind: 'matched'
      packageId: string
      method: 'approved_listing' | 'verified_gtin'
      firstAutomaticMatchAudit: boolean
    }
  | {
      kind: 'review'
      uncertaintyType:
        'unmatched_or_ambiguous' | 'contradiction' | 'unknown_package'
      reasons: string[]
    }

export type RankedOffer = {
  offerId: string
  listingId: string
  retailerId: string
  retailerName: string
  listingConfirmedAt: number
  payableAmountMinor: number
  requiredPackageCount: number
  totalUnits: number
  eligibility: 'universal' | 'restricted'
  conditionText: string | null
  availability: 'available' | 'unavailable' | 'unknown'
  confirmedAt: number
  declaredExpiresAt: number | null
}

const comparableFactNames = [
  'brand',
  'categoryCode',
  'normalizedSizeCode',
  'line',
  'variant',
  'gtin',
  'unitCount',
  'innerPackCount',
  'unitsPerInnerPack',
] as const satisfies readonly (keyof MatchFacts)[]

const normalizeText = (value: string) =>
  value.trim().normalize('NFKC').toLocaleLowerCase('nl-NL')

const normalizeFact = (value: NullableFact) =>
  typeof value === 'string' ? normalizeText(value) : value

const factsEqual = (left: MatchFacts, right: MatchFacts) =>
  comparableFactNames.every(
    (field) => normalizeFact(left[field]) === normalizeFact(right[field]),
  )

const conflictingFields = (left: MatchFacts, right: MatchFacts) =>
  comparableFactNames.filter((field) => {
    const leftValue = left[field]
    const rightValue = right[field]
    return (
      leftValue !== null &&
      rightValue !== null &&
      normalizeFact(leftValue) !== normalizeFact(rightValue)
    )
  })

export const createMatchFingerprint = (facts: MatchFacts) =>
  JSON.stringify(
    Object.fromEntries(
      comparableFactNames.map((field) => [field, normalizeFact(facts[field])]),
    ),
  )

export function parseNormalizedSize(source: string): NormalizedSizeCode | null {
  const match = source.trim().match(/^(?:maat|mt\.?|size)\s*([0-9](?:\+)?)$/i)
  const candidate = match?.[1]
  return normalizedSizeCodes.includes(candidate as NormalizedSizeCode)
    ? (candidate as NormalizedSizeCode)
    : null
}

export function createSourceNormalizer(input: {
  categoryAliases: Readonly<Record<string, CategoryCode>>
  sizeAliases: Readonly<Record<string, NormalizedSizeCode>>
}) {
  return {
    category(source: string): CategoryCode | null {
      const raw = source.trim()
      const category = input.categoryAliases[raw]
      return category !== undefined && categoryCodes.includes(category)
        ? category
        : null
    },
    size(source: string): NormalizedSizeCode | null {
      const exactSize = parseNormalizedSize(source)
      if (exactSize !== null) return exactSize
      const raw = source.trim()
      const size = input.sizeAliases[raw]
      return size !== undefined && normalizedSizeCodes.includes(size)
        ? size
        : null
    },
  }
}

export function buildProductIdentityKey(input: {
  brand: string
  categoryCode: CategoryCode
  line: string | null
  variant: string | null
  normalizedSizeCode: NormalizedSizeCode | null
}): string {
  if (
    !categoryCodes.includes(input.categoryCode) ||
    (input.categoryCode === 'wipes') !== (input.normalizedSizeCode === null) ||
    input.brand.trim() === ''
  ) {
    throw new Error('INVALID_PRODUCT_IDENTITY')
  }

  return [
    input.brand,
    input.categoryCode,
    input.line ?? '',
    input.variant ?? '',
    input.normalizedSizeCode ?? '',
  ]
    .map(normalizeText)
    .join('|')
}

export function calculateOfferPrice(input: {
  payableAmountMinor: number
  packageUnitCount: number
  requiredPackageCount: number
}) {
  const requiredPackageCount = input.requiredPackageCount
  if (
    !Number.isSafeInteger(input.payableAmountMinor) ||
    input.payableAmountMinor <= 0 ||
    !Number.isSafeInteger(input.packageUnitCount) ||
    input.packageUnitCount <= 0 ||
    !Number.isSafeInteger(requiredPackageCount) ||
    requiredPackageCount <= 0
  ) {
    throw new Error('INVALID_OFFER_PRICE')
  }

  const totalUnits = input.packageUnitCount * requiredPackageCount
  if (!Number.isSafeInteger(totalUnits)) {
    throw new Error('INVALID_OFFER_PRICE')
  }

  return {
    requiredPackageCount,
    totalUnits,
    unitPriceNumerator: input.payableAmountMinor,
    unitPriceDenominator: totalUnits,
  }
}

const isCurrent = (offer: RankedOffer, now: number) =>
  offer.availability === 'available' &&
  offer.listingConfirmedAt >= now - currentOfferFreshnessMilliseconds &&
  offer.confirmedAt >= now - currentOfferFreshnessMilliseconds &&
  (offer.declaredExpiresAt === null || offer.declaredExpiresAt > now)

const compareExactPrice = (left: RankedOffer, right: RankedOffer) => {
  const leftCrossProduct =
    BigInt(left.payableAmountMinor) * BigInt(right.totalUnits)
  const rightCrossProduct =
    BigInt(right.payableAmountMinor) * BigInt(left.totalUnits)
  return leftCrossProduct < rightCrossProduct
    ? -1
    : leftCrossProduct > rightCrossProduct
      ? 1
      : 0
}

const compareRankedOffers = (left: RankedOffer, right: RankedOffer) =>
  compareExactPrice(left, right) ||
  left.payableAmountMinor - right.payableAmountMinor ||
  right.confirmedAt - left.confirmedAt ||
  left.retailerName.localeCompare(right.retailerName, 'nl-NL') ||
  left.retailerId.localeCompare(right.retailerId) ||
  left.offerId.localeCompare(right.offerId)

export function rankCurrentOffers<Offer extends RankedOffer>(
  offers: Offer[],
  now: number,
) {
  if (!Number.isSafeInteger(now) || now < 0) {
    throw new Error('INVALID_CURRENT_TIME')
  }

  const current = offers.filter((candidate) => isCurrent(candidate, now))
  const primary = current
    .filter(({ eligibility }) => eligibility === 'universal')
    .sort(compareRankedOffers)
  const restricted = current
    .filter(({ eligibility }) => eligibility === 'restricted')
    .sort(compareRankedOffers)

  return {
    primary,
    restricted,
    bestWithoutMinimum:
      primary.find(({ requiredPackageCount }) => requiredPackageCount === 1) ??
      null,
  }
}

export type ObservedPriceFact = {
  offerKey: string
  observedAt: number
  payableAmountMinor: number
  totalUnits: number
  requiredPackageCount: number
  eligibility: 'universal' | 'restricted'
  availability: 'available' | 'unavailable' | 'unknown'
}

export function buildObservedPriceHistory(observations: ObservedPriceFact[]) {
  type CurrentPriceWinner = Pick<
    ObservedPriceFact,
    'offerKey' | 'payableAmountMinor' | 'totalUnits' | 'requiredPackageCount'
  > & { confirmedAt: number }
  const points: Array<
    Pick<
      ObservedPriceFact,
      | 'observedAt'
      | 'payableAmountMinor'
      | 'totalUnits'
      | 'requiredPackageCount'
    > & { continuity: 'start' | 'continuous' }
  > = []
  const currentOffers = new Map<string, ObservedPriceFact>()
  const state: { winner: CurrentPriceWinner | null } = { winner: null }

  for (const observation of [...observations].sort(
    (left, right) => left.observedAt - right.observedAt,
  )) {
    for (const [offerKey, currentOffer] of currentOffers) {
      if (
        observation.observedAt - currentOffer.observedAt >
        currentOfferFreshnessMilliseconds
      ) {
        currentOffers.delete(offerKey)
      }
    }
    if (
      observation.eligibility === 'restricted' ||
      observation.availability !== 'available'
    ) {
      currentOffers.delete(observation.offerKey)
    } else {
      currentOffers.set(observation.offerKey, observation)
    }
    if (state.winner !== null && !currentOffers.has(state.winner.offerKey)) {
      state.winner = null
    }
    const winner = [...currentOffers.values()].sort((left, right) => {
      const leftPrice =
        BigInt(left.payableAmountMinor) * BigInt(right.totalUnits)
      const rightPrice =
        BigInt(right.payableAmountMinor) * BigInt(left.totalUnits)
      if (leftPrice !== rightPrice) return leftPrice < rightPrice ? -1 : 1
      return (
        left.payableAmountMinor - right.payableAmountMinor ||
        left.requiredPackageCount - right.requiredPackageCount ||
        left.offerKey.localeCompare(right.offerKey)
      )
    })[0]
    if (!winner) {
      state.winner = null
      continue
    }
    const previousWinner = state.winner
    const isUnchanged =
      previousWinner !== null &&
      previousWinner.offerKey === winner.offerKey &&
      previousWinner.payableAmountMinor === winner.payableAmountMinor &&
      previousWinner.totalUnits === winner.totalUnits &&
      previousWinner.requiredPackageCount === winner.requiredPackageCount
    const continuous =
      previousWinner !== null &&
      observation.observedAt - previousWinner.confirmedAt <=
        currentOfferFreshnessMilliseconds
    if (!isUnchanged) {
      points.push({
        observedAt: winner.observedAt,
        payableAmountMinor: winner.payableAmountMinor,
        totalUnits: winner.totalUnits,
        requiredPackageCount: winner.requiredPackageCount,
        continuity: continuous ? 'continuous' : 'start',
      })
    }
    state.winner = {
      offerKey: winner.offerKey,
      payableAmountMinor: winner.payableAmountMinor,
      totalUnits: winner.totalUnits,
      requiredPackageCount: winner.requiredPackageCount,
      confirmedAt:
        observation.offerKey === winner.offerKey
          ? observation.observedAt
          : (previousWinner?.confirmedAt ?? winner.observedAt),
    }
  }
  return points
}

const hasValidGtinChecksum = (gtin: string) => {
  if (!/^(?:\d{8}|\d{12,14})$/.test(gtin)) return false
  const digits = [...gtin].map(Number)
  const checkDigit = digits.pop()
  const sum = digits
    .reverse()
    .reduce(
      (total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1),
      0,
    )
  return checkDigit === (10 - (sum % 10)) % 10
}

export function decideListingMatch(input: {
  observed: MatchFacts
  approved: {
    packageId: string
    fingerprint: MatchFacts
    automaticReuseBlocked: boolean
  } | null
  verifiedGtin?: {
    value: string
    provenance: 'authorized_feed' | 'manufacturer' | 'retailer_page' | 'model'
  }
  verifiedGtinPackages: PackageMatchCandidate[]
}): MatchDecision {
  if (
    input.approved &&
    !input.approved.automaticReuseBlocked &&
    factsEqual(input.observed, input.approved.fingerprint)
  ) {
    return {
      kind: 'matched',
      packageId: input.approved.packageId,
      method: 'approved_listing',
      firstAutomaticMatchAudit: false,
    }
  }

  const gtin = input.verifiedGtin
  const hasAuthoritativeGtin =
    gtin !== undefined &&
    (gtin.provenance === 'authorized_feed' ||
      gtin.provenance === 'manufacturer') &&
    gtin.value === input.observed.gtin &&
    hasValidGtinChecksum(gtin.value)

  if (hasAuthoritativeGtin) {
    const sameGtin = input.verifiedGtinPackages.filter(
      (candidate) =>
        candidate.active &&
        candidate.facts.gtin !== null &&
        candidate.facts.gtin === gtin.value,
    )
    const conflicts = sameGtin.flatMap((candidate) =>
      conflictingFields(input.observed, candidate.facts),
    )
    if (conflicts.length > 0) {
      return {
        kind: 'review',
        uncertaintyType: 'contradiction',
        reasons: [...new Set(conflicts)],
      }
    }
    if (sameGtin.length === 1) {
      return {
        kind: 'matched',
        packageId: sameGtin[0].packageId,
        method: 'verified_gtin',
        firstAutomaticMatchAudit: true,
      }
    }
    return {
      kind: 'review',
      uncertaintyType:
        sameGtin.length === 0 ? 'unknown_package' : 'unmatched_or_ambiguous',
      reasons: [
        sameGtin.length === 0
          ? 'verified_gtin_not_in_catalog'
          : 'verified_gtin_not_unique',
      ],
    }
  }

  const knownConflicts = input.verifiedGtinPackages.flatMap((candidate) =>
    conflictingFields(input.observed, candidate.facts),
  )
  return {
    kind: 'review',
    uncertaintyType:
      knownConflicts.length > 0 ? 'contradiction' : 'unmatched_or_ambiguous',
    reasons:
      knownConflicts.length > 0
        ? [...new Set(knownConflicts)]
        : ['no_authoritative_automatic_path'],
  }
}

const candidateFieldLabels: Partial<Record<keyof MatchFacts, string>> = {
  brand: 'brand',
  categoryCode: 'category',
  normalizedSizeCode: 'size',
  line: 'line',
  variant: 'variant',
  gtin: 'gtin',
  unitCount: 'quantity',
  innerPackCount: 'innerPackCount',
  unitsPerInnerPack: 'unitsPerInnerPack',
}

export function deriveMatchingCandidates(
  observed: MatchFacts,
  catalog: PackageMatchCandidate[],
) {
  return catalog
    .filter(({ active, facts }) => {
      if (!active) return false
      for (const field of ['brand', 'categoryCode'] as const) {
        if (
          observed[field] === null ||
          facts[field] === null ||
          normalizeFact(observed[field]) !== normalizeFact(facts[field])
        ) {
          return false
        }
      }
      if (
        observed.categoryCode !== 'wipes' &&
        (observed.normalizedSizeCode === null ||
          facts.normalizedSizeCode === null ||
          observed.normalizedSizeCode !== facts.normalizedSizeCode)
      ) {
        return false
      }
      return conflictingFields(observed, facts).length === 0
    })
    .map((candidate) => {
      const agreeingFields: string[] = []
      const missingCriticalFacts: string[] = []
      for (const field of comparableFactNames) {
        const observedValue = observed[field]
        const candidateValue = candidate.facts[field]
        const label = candidateFieldLabels[field] ?? field
        if (observedValue === null || candidateValue === null) {
          missingCriticalFacts.push(label)
        } else if (
          normalizeFact(observedValue) === normalizeFact(candidateValue)
        ) {
          agreeingFields.push(label)
        }
      }
      return {
        packageId: candidate.packageId,
        agreeingFields,
        missingCriticalFacts,
        conflictReasons: [] as string[],
      }
    })
    .sort(
      (left, right) =>
        candidatePreference(right.agreeingFields) -
          candidatePreference(left.agreeingFields) ||
        right.agreeingFields.length - left.agreeingFields.length ||
        left.missingCriticalFacts.length - right.missingCriticalFacts.length ||
        left.packageId.localeCompare(right.packageId),
    )
    .slice(0, 3)
}

const candidatePreference = (agreeingFields: string[]) =>
  (agreeingFields.includes('line') ? 4 : 0) +
  (agreeingFields.includes('variant') ? 3 : 0) +
  (agreeingFields.includes('quantity') ? 2 : 0) +
  (agreeingFields.includes('innerPackCount') ? 1 : 0) +
  (agreeingFields.includes('unitsPerInnerPack') ? 1 : 0)
