import { describe, expect, it } from 'vitest'

import {
  getPublicProduct,
  listPublicProducts,
  publicCategoryBySlug,
  publicFixtureNow,
} from '../src/public/catalog'
import { sizeBrowseHead } from '../src/public/pages'
import {
  homeStructuredData,
  listIndexablePublicPaths,
  productPageHead,
  productStructuredData,
  publicSiteOrigin,
  robotsTxt,
} from '../src/public/seo'

describe('public SEO surfaces', () => {
  it('lists only canonical indexable landings, Products, and trust pages', () => {
    const paths = listIndexablePublicPaths()

    expect(paths).toContain('/')
    expect(paths).toContain('/luiers')
    expect(paths).toContain('/luiers/maat-4-plus')
    expect(paths).toContain('/luierbroekjes/maat-5')
    expect(paths).toContain('/billendoekjes')
    expect(paths).toContain('/producten/zacht-start-original-maat-4-plus-p001')
    expect(paths).toContain('/producten/zacht-start-nacht-maat-4-plus-p025')
    expect(paths).toContain('/methode')
    expect(paths).toContain('/verdienmodel')
    expect(paths).toContain('/dekking')
    expect(paths).toContain('/privacy')
    expect(paths).toContain('/contact')
    expect(paths).not.toContain('/vinden')
    expect(paths).not.toContain('/admin')
    expect(paths).not.toContain('/luiers/maat-4-plus?page=2')
    expect(paths).not.toContain('/luiers/maat-1')
    expect(paths.every((path) => !path.includes('?'))).toBe(true)
  })

  it('keeps robots.txt pointing at the sitemap and away from Admin', () => {
    expect(robotsTxt()).toBe(
      [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin',
        'Disallow: /vinden',
        `Sitemap: ${publicSiteOrigin}/sitemap.xml`,
        '',
      ].join('\n'),
    )
  })

  it('emits AggregateOffer only from current universal pack prices', () => {
    const current = getPublicProduct(
      'zacht-start-original-maat-4-plus-p001',
      publicFixtureNow,
    )!
    const stale = getPublicProduct(
      'zacht-start-nacht-maat-4-plus-p025',
      publicFixtureNow,
    )!
    const currentData = productStructuredData(current)
    const offer = currentData.find((entry) => entry['@type'] === 'Product') as {
      offers: {
        '@type': string
        priceCurrency: string
        lowPrice: string
        highPrice: string
        offerCount: string
      }
    }

    expect(
      currentData.some((entry) => entry['@type'] === 'BreadcrumbList'),
    ).toBe(true)
    expect(offer.offers).toEqual({
      '@type': 'AggregateOffer',
      priceCurrency: 'EUR',
      lowPrice: '8.99',
      highPrice: '14.99',
      offerCount: '2',
    })
    expect(stale.offers.primary).toEqual([])
    expect(
      productStructuredData(stale).some((entry) => 'offers' in entry),
    ).toBe(false)
  })

  it('omits AggregateOffer and current-price claims for degraded Products', () => {
    const degraded = getPublicProduct(
      'zacht-start-comfort-maat-4-plus-p026',
      publicFixtureNow,
    )!
    const stale = getPublicProduct(
      'zacht-start-nacht-maat-4-plus-p025',
      publicFixtureNow,
    )!
    const unavailable = getPublicProduct(
      'zacht-start-reis-maat-5-p027',
      publicFixtureNow,
    )!

    expect(
      productStructuredData(degraded).some((entry) => 'offers' in entry),
    ).toBe(false)
    expect(
      productStructuredData(unavailable).some((entry) => 'offers' in entry),
    ).toBe(false)
    expect(productPageHead(degraded).meta).toEqual(
      expect.arrayContaining([
        {
          name: 'description',
          content:
            'Prijzen tijdelijk niet beschikbaar voor Zacht & Start Comfort Flex maat 4+. Identiteit en historie blijven zichtbaar.',
        },
      ]),
    )
    expect(productPageHead(stale).meta).toEqual(
      expect.arrayContaining([
        {
          name: 'description',
          content:
            'Geen actuele prijs voor Zacht & Start Nacht Extra absorberend maat 4+ binnen 48 uur. Historie blijft zichtbaar.',
        },
      ]),
    )
  })

  it('describes Home with truthful Organization identity', () => {
    expect(homeStructuredData()).toEqual({
      '@context': 'https://schema.org',
      '@type': ['Organization', 'WebSite'],
      name: 'Babyboel',
      url: `${publicSiteOrigin}/`,
    })
  })

  it('treats empty size landings as present but not indexable', () => {
    const empty = listPublicProducts({
      category: 'luiers',
      size: '1',
      page: 1,
      now: publicFixtureNow,
    })
    expect(empty.total).toBe(0)
    expect(listIndexablePublicPaths()).not.toContain('/luiers/maat-1')
    expect(sizeBrowseHead(publicCategoryBySlug.luiers, '1').meta).toEqual(
      expect.arrayContaining([
        { name: 'robots', content: 'noindex, follow' },
        {
          name: 'description',
          content: 'Geen Products voor luiers maat 1 in deze vergelijking.',
        },
      ]),
    )
  })
})
