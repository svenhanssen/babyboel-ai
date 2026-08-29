// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import axe from 'axe-core'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AppShell } from '../src/ui/app-shell'
import { PriceHistory } from '../src/ui/price-history'

function setSystemTheme(theme: 'light' | 'dark') {
  const matches = theme === 'dark'

  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({
      matches,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  )
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
  vi.unstubAllGlobals()
})

describe('app shell', () => {
  it('exposes an accessible navigation and content structure', async () => {
    setSystemTheme('light')
    const { container } = render(
      <AppShell>
        <main id="main">
          <h1>Vergelijk aanbiedingen</h1>
          <PriceHistory
            points={[
              { observedOn: '2026-08-27', priceCents: 1249 },
              { observedOn: '2026-08-28', priceCents: null },
              { observedOn: '2026-08-29', priceCents: 1199 },
            ]}
          />
        </main>
      </AppShell>,
    )

    expect(
      screen
        .getByRole('link', { name: 'Naar hoofdinhoud' })
        .getAttribute('href'),
    ).toBe('#main')
    expect(
      screen.getByRole('navigation', { name: 'Hoofdnavigatie' }),
    ).toBeTruthy()
    expect(
      screen.getByRole('table', { name: 'Prijsgeschiedenis als tabel' }),
    ).toBeTruthy()
    expect(screen.getByText('Geen waarneming')).toBeTruthy()
    expect(
      (
        await axe.run(container, {
          rules: { 'color-contrast': { enabled: false } },
        })
      ).violations,
    ).toEqual([])
  })

  it('offers the opposite system theme and stores only an override', async () => {
    setSystemTheme('dark')
    const user = userEvent.setup()
    render(
      <AppShell>
        <main id="main">Inhoud</main>
      </AppShell>,
    )

    const toggle = screen.getByRole('button', {
      name: 'Licht thema gebruiken',
    })
    await user.click(toggle)

    expect(document.documentElement.dataset.theme).toBe('light')
    expect(localStorage.getItem('babyboel-theme')).toBe('light')

    await user.click(
      screen.getByRole('button', { name: 'Donker thema gebruiken' }),
    )

    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(localStorage.getItem('babyboel-theme')).toBeNull()
  })

  it('keeps the theme control usable when storage is unavailable', async () => {
    setSystemTheme('light')
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage blocked')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage blocked')
    })
    const user = userEvent.setup()

    render(
      <AppShell>
        <main id="main">Inhoud</main>
      </AppShell>,
    )
    await user.click(
      screen.getByRole('button', { name: 'Donker thema gebruiken' }),
    )

    expect(document.documentElement.dataset.theme).toBe('dark')
  })
})
