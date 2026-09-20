import { requireVerifiedOutboundDestination } from '../security/outbound'

export const outboundPlacementCodes = ['product_offer'] as const
export type OutboundPlacementCode = (typeof outboundPlacementCodes)[number]

export interface AffiliateProgramConfig {
  enabled: boolean
  termsReference: string
  trackingOrigin: string
  path: string
  destinationParam: string
  subIdParam: string
  allowedHosts: readonly string[]
  allowedParams: readonly string[]
  extraParams: Record<string, string>
}

export interface OutboundAction {
  href: string
  affiliateLink: boolean
  rel: 'sponsored noopener' | 'noopener'
  referrerPolicy: 'strict-origin-when-cross-origin'
}

export const affiliatePrograms = {
  plein: {
    enabled: true,
    termsReference: 'fixture-plein-affiliate-approval',
    trackingOrigin: 'https://partners.example',
    path: '/click',
    destinationParam: 'destination',
    subIdParam: 'subid',
    allowedHosts: ['partners.example'],
    allowedParams: ['destination', 'camref', 'subid'],
    extraParams: { camref: 'babyboel-fixture' },
  },
  wehkamp: {
    enabled: false,
    termsReference: 'fixture-wehkamp-affiliate-not-enabled',
    trackingOrigin: 'https://partners.example',
    path: '/click',
    destinationParam: 'destination',
    subIdParam: 'subid',
    allowedHosts: ['partners.example'],
    allowedParams: ['destination', 'camref', 'subid'],
    extraParams: { camref: 'babyboel-fixture' },
  },
} as const satisfies Record<string, AffiliateProgramConfig>

export type AffiliateProgramSlug = keyof typeof affiliatePrograms

const verifiedDestinationAction = (
  verifiedDestination: string,
): OutboundAction => ({
  href: verifiedDestination,
  affiliateLink: false,
  rel: 'noopener',
  referrerPolicy: 'strict-origin-when-cross-origin',
})

const parseHttpsOrigin = (value: string) => {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('AFFILIATE_CONFIG_REJECTED')
  }
  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error('AFFILIATE_CONFIG_REJECTED')
  }
  return url
}

const isAllowedParamName = (name: string, allowedParams: readonly string[]) =>
  allowedParams.includes(name)

export function resolveOutboundAction(input: {
  retailerSlug: string
  verifiedDestination: string
  placement?: OutboundPlacementCode
  programs?: Record<string, AffiliateProgramConfig>
}): OutboundAction {
  const verified = requireVerifiedOutboundDestination(
    input.verifiedDestination,
    input.verifiedDestination,
  )
  const placement = input.placement ?? 'product_offer'
  const programs = (input.programs ?? affiliatePrograms) as Record<
    string,
    AffiliateProgramConfig
  >
  const program = programs[input.retailerSlug]
  if (!program?.enabled) return verifiedDestinationAction(verified)

  try {
    if (
      !isAllowedParamName(program.destinationParam, program.allowedParams) ||
      !isAllowedParamName(program.subIdParam, program.allowedParams) ||
      Object.keys(program.extraParams).some(
        (name) => !isAllowedParamName(name, program.allowedParams),
      )
    ) {
      return verifiedDestinationAction(verified)
    }

    const origin = parseHttpsOrigin(program.trackingOrigin)
    if (!program.allowedHosts.includes(origin.hostname)) {
      return verifiedDestinationAction(verified)
    }

    const href = new URL(program.path, origin)
    href.search = ''
    href.searchParams.set(program.destinationParam, verified)
    href.searchParams.set(program.subIdParam, placement)
    for (const [name, value] of Object.entries(program.extraParams)) {
      href.searchParams.set(name, value)
    }

    if (
      href.protocol !== 'https:' ||
      !program.allowedHosts.includes(href.hostname) ||
      [...href.searchParams.keys()].some(
        (name) => !isAllowedParamName(name, program.allowedParams),
      )
    ) {
      return verifiedDestinationAction(verified)
    }

    return {
      href: href.href,
      affiliateLink: true,
      rel: 'sponsored noopener',
      referrerPolicy: 'strict-origin-when-cross-origin',
    }
  } catch {
    return verifiedDestinationAction(verified)
  }
}

export function retailerSlugFromName(name: string) {
  return name.trim().toLocaleLowerCase('nl-NL')
}
