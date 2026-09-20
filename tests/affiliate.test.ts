import { describe, expect, it } from 'vitest'

import { getPublicProduct, publicFixtureNow } from '../src/public/catalog'
import {
  affiliatePrograms,
  resolveOutboundAction,
} from '../src/public/affiliate'

const verifiedPlein = 'https://retailer.example/plein-multi'
const verifiedWehkamp = 'https://retailer.example/wehkamp-single'

describe('affiliate destination construction', () => {
  it('keeps the verified Listing destination when attribution is applied', () => {
    const action = resolveOutboundAction({
      retailerSlug: 'plein',
      verifiedDestination: verifiedPlein,
    })

    expect(action.affiliateLink).toBe(true)
    expect(action.rel).toBe('sponsored noopener')
    expect(action.referrerPolicy).toBe('strict-origin-when-cross-origin')
    const href = new URL(action.href)
    expect(href.protocol).toBe('https:')
    expect(href.hostname).toBe('partners.example')
    expect(href.searchParams.get('destination')).toBe(verifiedPlein)
    expect(href.searchParams.get('subid')).toBe('product_offer')
    expect(affiliatePrograms.plein.termsReference).toMatch(/terms/)
    expect(affiliatePrograms.wehkamp.enabled).toBe(false)
  })

  it('falls back to the ordinary verified destination when attribution is off', () => {
    const action = resolveOutboundAction({
      retailerSlug: 'wehkamp',
      verifiedDestination: verifiedWehkamp,
    })

    expect(action).toEqual({
      href: verifiedWehkamp,
      affiliateLink: false,
      rel: 'noopener',
      referrerPolicy: 'strict-origin-when-cross-origin',
    })
  })

  it('falls back when configuration is disabled, malformed, or leaves the allowlist', () => {
    expect(
      resolveOutboundAction({
        retailerSlug: 'plein',
        verifiedDestination: verifiedPlein,
        programs: {
          ...affiliatePrograms,
          plein: { ...affiliatePrograms.plein, enabled: false },
        },
      }).href,
    ).toBe(verifiedPlein)

    expect(
      resolveOutboundAction({
        retailerSlug: 'plein',
        verifiedDestination: verifiedPlein,
        programs: {
          ...affiliatePrograms,
          plein: {
            ...affiliatePrograms.plein,
            trackingOrigin: 'http://partners.example',
          },
        },
      }).href,
    ).toBe(verifiedPlein)

    expect(
      resolveOutboundAction({
        retailerSlug: 'plein',
        verifiedDestination: verifiedPlein,
        programs: {
          ...affiliatePrograms,
          plein: {
            ...affiliatePrograms.plein,
            extraParams: {
              ...affiliatePrograms.plein.extraParams,
              evil: 'https://attacker.example',
            },
          },
        },
      }).href,
    ).toBe(verifiedPlein)
  })

  it('does not let affiliate status change inclusion or ranking', () => {
    const product = getPublicProduct(
      'zacht-start-original-maat-4-plus-p001',
      publicFixtureNow,
    )

    expect(
      product?.offers.primary.map(({ sourceOfferKey, retailerName }) => [
        sourceOfferKey,
        retailerName,
      ]),
    ).toEqual([
      ['plein-multi', 'Plein'],
      ['wehkamp-single', 'Wehkamp'],
    ])
    expect(product?.offers.primary[0]?.outboundDestination).toBe(verifiedPlein)
    expect(product?.offers.primary[0]?.action.affiliateLink).toBe(true)
    expect(product?.offers.primary[1]?.action.affiliateLink).toBe(false)
    expect(product?.offers.primary[0]?.action.href).not.toBe(
      product?.offers.primary[1]?.action.href,
    )
    expect(
      new URL(product?.offers.primary[0]?.action.href ?? '').searchParams.get(
        'destination',
      ),
    ).toBe(verifiedPlein)
  })
})
