// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { TrustPage, trustPages } from '../src/public/trust-page'
import { publicContactEmail } from '../src/public/trust-identity'

afterEach(cleanup)

describe('Dutch trust copy', () => {
  it('explains ranking, freshness, and error reporting on /methode', () => {
    render(<TrustPage page={trustPages.methode} />)

    expect(screen.getByRole('heading', { level: 1 }).textContent).toMatch(
      /vergelijkt/i,
    )
    expect(screen.getByText(/48 uur/)).toBeTruthy()
    expect(screen.getAllByText(/universele stukprijs/i).length).toBeGreaterThan(
      0,
    )
    expect(screen.getByText(/verzending/i)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Contact' })).toBeTruthy()
  })

  it('keeps commission independent from ranking on /verdienmodel', () => {
    render(<TrustPage page={trustPages.verdienmodel} />)

    expect(screen.getByText(/commissie/i)).toBeTruthy()
    expect(screen.getAllByText(/rangschikking/i).length).toBeGreaterThan(0)
    expect(
      screen.getByRole('heading', { name: /geen bezoekersprofiel/i }),
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { name: /directe bestemming/i }),
    ).toBeTruthy()
  })

  it('lists coverage statuses without whole-market claims on /dekking', () => {
    render(<TrustPage page={trustPages.dekking} />)

    expect(screen.getAllByText('actief').length).toBeGreaterThan(0)
    expect(screen.getByText(/tijdelijk gepauzeerd/)).toBeTruthy()
    expect(screen.getAllByText('nog niet actief').length).toBeGreaterThan(0)
    expect(screen.getByText('Wehkamp')).toBeTruthy()
    expect(screen.getByText('Plein')).toBeTruthy()
    expect(
      screen.getByText(/nooit als .*goedkoopste van Nederland/i),
    ).toBeTruthy()
  })

  it('documents contact, privacy, and cookieless intent counting', () => {
    render(<TrustPage page={trustPages.privacy} />)
    expect(screen.getAllByText(publicContactEmail).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Cloudflare/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/aggregaat/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/Autoriteit Persoonsgegevens/)).toBeTruthy()
    expect(screen.queryByText(/cookie banner/i)).toBeNull()
    expect(screen.getByText(/AVG artikel 6/)).toBeTruthy()
    expect(screen.getByText(/gerechtvaardigd belang/)).toBeTruthy()

    cleanup()
    render(<TrustPage page={trustPages.contact} />)
    expect(screen.getByRole('link', { name: publicContactEmail })).toBeTruthy()
    expect(screen.getByText(/geen gezondheidsgegevens/i)).toBeTruthy()
    expect(screen.getByText(/onderwerp .*Toegankelijkheid/)).toBeTruthy()
  })
})
