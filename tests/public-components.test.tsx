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
  })

  it('renders an accessible degraded Product without current actions', async () => {
    const product = getPublicProduct(
      'zacht-start-comfort-maat-4-plus-p026',
      publicFixtureNow,
    )!
    const { container } = render(<ProductPageContent product={product} />)

    expect(screen.getByText(/tijdelijk niet volledig controleren/)).toBeTruthy()
    expect(screen.queryByRole('link', { name: /Bekijk bij/ })).toBeNull()
    expect(
      (
        await axe.run(container, {
          rules: { 'color-contrast': { enabled: false } },
        })
      ).violations,
    ).toEqual([])
  })
})
