// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import axe from 'axe-core'
import { afterEach, describe, expect, it } from 'vitest'

import {
  OfferComparison,
  ProductCard,
  ProductPageContent,
} from '../src/public/components'
import {
  getPublicProduct,
  listPublicProducts,
  publicFixtureNow,
} from '../src/public/catalog'

afterEach(cleanup)

describe('public comparison components', () => {
  it('shows exact ranked card facts including a winning multi-buy', () => {
    const product = listPublicProducts({
      category: 'luiers',
      size: '4+',
      page: 1,
      now: publicFixtureNow,
    }).products[0]

    render(<ProductCard product={product} />)

    expect(screen.getByText('€ 0,21 per stuk')).toBeTruthy()
    expect(screen.getByText(/2 verpakkingen · 72 stuks/)).toBeTruthy()
    expect(
      screen.getByRole('link', { name: /Bekijk Zacht & Start Original/ }),
    ).toBeTruthy()
  })

  it('separates universal and restricted Offers with same-tab actions', () => {
    const product = getPublicProduct(
      'zacht-start-original-maat-4-plus-p001',
      publicFixtureNow,
    )!
    render(<OfferComparison product={product} />)

    expect(
      screen.getByRole('heading', { name: 'Aanbiedingen voor iedereen' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: 'Aanbiedingen met voorwaarden' }),
    ).toBeTruthy()
    expect(screen.getByText('Alleen met ledenvoordeel')).toBeTruthy()
    expect(
      screen
        .getAllByRole('link', { name: /Bekijk bij/ })
        .every((link) => !link.hasAttribute('target')),
    ).toBe(true)
    expect(screen.getByText(/€ 14,99 ÷ 72 stuks/)).toBeTruthy()
    const pleinLink = screen.getAllByRole('link', {
      name: 'Bekijk bij Plein',
    })[0]
    expect(pleinLink?.getAttribute('href')).toBe(
      'https://partners.example/click?destination=https%3A%2F%2Fretailer.example%2Fplein-multi&subid=product_offer&camref=babyboel-fixture',
    )
    expect(pleinLink?.getAttribute('rel')).toBe('sponsored noopener')
    expect(
      screen
        .getByRole('link', { name: 'Bekijk bij Wehkamp' })
        .getAttribute('rel'),
    ).toBe('noopener')
    expect(screen.getByRole('link', { name: 'Verdienmodel' })).toBeTruthy()
  })

  it('renders an accessible degraded Product without current actions', async () => {
    const product = getPublicProduct(
      'zacht-start-comfort-maat-4-plus-p026',
      publicFixtureNow,
    )!
    const { container } = render(<ProductPageContent product={product} />)

    expect(screen.getByText(/tijdelijk niet verifiëren/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Bekijk bij/ })).toBeNull()
    expect(
      screen.getAllByRole('link', { name: 'Verdienmodel' }).length,
    ).toBeGreaterThan(0)
    expect(
      (
        await axe.run(container, {
          rules: { 'color-contrast': { enabled: false } },
        })
      ).violations,
    ).toEqual([])
  })

  it('shows relative freshness and the four public Product states on cards', () => {
    const current = listPublicProducts({
      category: 'luiers',
      size: '4+',
      page: 1,
      now: publicFixtureNow,
    }).products[0]
    const laterPage = listPublicProducts({
      category: 'luiers',
      size: '4+',
      page: 2,
      now: publicFixtureNow,
    }).products
    const stale = laterPage.find((product) => product.id === 'p025')!
    const degraded = laterPage.find((product) => product.id === 'p026')!
    const unavailable = listPublicProducts({
      category: 'luiers',
      size: '5',
      page: 1,
      now: publicFixtureNow,
    }).products.find((product) => product.id === 'p027')!

    render(<ProductCard product={current} />)
    expect(screen.getByText(/Bevestigd 2 uur geleden/)).toBeTruthy()
    cleanup()

    render(<ProductCard product={stale} />)
    expect(screen.getByText('Geen actuele prijs')).toBeTruthy()
    cleanup()

    render(<ProductCard product={degraded} />)
    expect(screen.getByText('Prijzen tijdelijk niet beschikbaar')).toBeTruthy()
    cleanup()

    render(<ProductCard product={unavailable} />)
    expect(screen.getByText('Niet meer verkrijgbaar')).toBeTruthy()
  })

  it('keeps Product lede Dutch and state-specific', () => {
    const current = getPublicProduct(
      'zacht-start-original-maat-4-plus-p001',
      publicFixtureNow,
    )!
    render(<ProductPageContent product={current} />)
    expect(
      screen.getByText('Vergelijk actuele Offers voor precies dit Product.'),
    ).toBeTruthy()
    expect(screen.queryByText(/Current Offers/)).toBeNull()
  })
})
