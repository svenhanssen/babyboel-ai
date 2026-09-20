import { describe, expect, it } from 'vitest'

import {
  getPublicProduct,
  listPublicProducts,
  publicCategories,
  publicFixtureNow,
} from '../src/public/catalog'

describe('fixture-backed public catalog', () => {
  it('offers the three launch categories and exact normalized sizes', () => {
    expect(publicCategories.map(({ slug }) => slug)).toEqual([
      'luiers',
      'luierbroekjes',
      'billendoekjes',
    ])
    expect(
      publicCategories.find(({ slug }) => slug === 'luiers')?.sizes,
    ).toContain('4+')
    expect(
      publicCategories.find(({ slug }) => slug === 'billendoekjes')?.sizes,
    ).toEqual([])
  })

  it('ranks current universal Offers exactly and paginates at 24 Products', () => {
    const firstPage = listPublicProducts({
      category: 'luiers',
      size: '4+',
      page: 1,
      now: publicFixtureNow,
    })
    const secondPage = listPublicProducts({
      category: 'luiers',
      size: '4+',
      page: 2,
      now: publicFixtureNow,
    })

    expect(firstPage.total).toBe(26)
    expect(firstPage.products).toHaveLength(24)
    expect(secondPage.products).toHaveLength(2)
    expect(firstPage.products[0]?.bestOffer?.retailerName).toBe('Plein')
    expect(firstPage.products.at(-1)?.bestOffer).not.toBeNull()
    expect(secondPage.products.at(-1)?.bestOffer).toBeNull()
  })

  it('separates restricted Offers and keeps a one-Package alternative', () => {
    const product = getPublicProduct(
      'zacht-start-original-maat-4-plus-p001',
      publicFixtureNow,
    )

    expect(
      product?.offers.primary.map(({ sourceOfferKey }) => sourceOfferKey),
    ).toEqual(['plein-multi', 'wehkamp-single'])
    expect(
      product?.offers.restricted.map(({ sourceOfferKey }) => sourceOfferKey),
    ).toEqual(['plein-member'])
    expect(product?.offers.bestWithoutMinimum?.sourceOfferKey).toBe(
      'wehkamp-single',
    )
  })

  it('suppresses stale prices and actions while retaining history', () => {
    const product = getPublicProduct(
      'zacht-start-nacht-maat-4-plus-p025',
      publicFixtureNow,
    )

    expect(product?.availabilityState).toBe('no_current_offer')
    expect(product?.offers.primary).toEqual([])
    expect(product?.history.length).toBeGreaterThan(0)
  })

  it('fails closed for a degraded retailer comparison', () => {
    const product = getPublicProduct(
      'zacht-start-comfort-maat-4-plus-p026',
      publicFixtureNow,
    )

    expect(product?.availabilityState).toBe('degraded')
    expect(product?.offers.primary).toEqual([])
    expect(product?.degradedRetailers).toEqual(['Wehkamp'])
  })

  it('keeps verified Offers when only some retailers cannot be confirmed', () => {
    const product = getPublicProduct(
      'zacht-start-dag-maat-5-p028',
      publicFixtureNow,
    )

    expect(product?.availabilityState).toBe('current')
    expect(product?.degradedRetailers).toEqual(['Wehkamp'])
    expect(
      product?.offers.primary.map(({ sourceOfferKey, retailerName }) => [
        sourceOfferKey,
        retailerName,
      ]),
    ).toEqual([['plein-p028', 'Plein']])
  })

  it('keeps retailer-reported unavailability distinct from stale prices', () => {
    const product = getPublicProduct(
      'zacht-start-reis-maat-5-p027',
      publicFixtureNow,
    )

    expect(product?.availabilityState).toBe('unavailable')
    expect(product?.offers.primary).toEqual([])
  })

  it('rejects impossible pages and mismatched route sizes', () => {
    expect(() =>
      listPublicProducts({
        category: 'luiers',
        size: '5+',
        page: 2,
        now: publicFixtureNow,
      }),
    ).toThrow('Pagina bestaat niet')
    expect(() =>
      listPublicProducts({
        category: 'billendoekjes',
        size: '4',
        page: 1,
        now: publicFixtureNow,
      }),
    ).toThrow('Maat is niet geldig')
  })
})
