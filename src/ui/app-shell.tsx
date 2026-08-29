import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { isTheme, themeStorageKey } from './theme'
import type { Theme } from './theme'

const darkThemeQuery = '(prefers-color-scheme: dark)'

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(themeStorageKey)
    return isTheme(value) ? value : null
  } catch {
    return null
  }
}

function persistTheme(theme: Theme | null) {
  try {
    if (theme === null) localStorage.removeItem(themeStorageKey)
    else localStorage.setItem(themeStorageKey, theme)
  } catch {
    // The visual choice still applies for this page when storage is blocked.
  }
}

function systemTheme(): Theme {
  return matchMedia(darkThemeQuery).matches ? 'dark' : 'light'
}

function resolvedTheme(): Theme {
  return storedTheme() ?? systemTheme()
}

function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null)

  useEffect(() => {
    const media = matchMedia(darkThemeQuery)
    const syncTheme = () => setTheme(resolvedTheme())
    const syncSystemTheme = () => {
      if (storedTheme() === null) syncTheme()
    }

    syncTheme()
    media.addEventListener('change', syncSystemTheme)
    return () => media.removeEventListener('change', syncSystemTheme)
  }, [])

  function toggleTheme() {
    const currentTheme = theme ?? resolvedTheme()
    const nextTheme = currentTheme === 'dark' ? 'light' : 'dark'

    if (nextTheme === systemTheme()) {
      persistTheme(null)
      document.documentElement.removeAttribute('data-theme')
    } else {
      persistTheme(nextTheme)
      document.documentElement.dataset.theme = nextTheme
    }

    setTheme(nextTheme)
  }

  const nextTheme = theme === 'dark' ? 'light' : 'dark'
  const label =
    nextTheme === 'light' ? 'Licht thema gebruiken' : 'Donker thema gebruiken'

  return (
    <button
      aria-label={label}
      className="icon-button"
      onClick={toggleTheme}
      suppressHydrationWarning
      type="button"
    >
      {nextTheme === 'light' ? (
        <Sun aria-hidden="true" />
      ) : (
        <Moon aria-hidden="true" />
      )}
    </button>
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <>
      <a className="skip-link" href="#main">
        Naar hoofdinhoud
      </a>
      <header className="site-header">
        <nav aria-label="Hoofdnavigatie" className="site-nav">
          <a aria-label="Babyboel, startpagina" className="wordmark" href="/">
            babyboel
          </a>
          <div className="site-nav__actions">
            <a className="nav-link" href="/admin">
              Admin
            </a>
            <ThemeToggle />
          </div>
        </nav>
      </header>
      {children}
      <footer className="site-footer">
        <p>Helder vergelijken op basis van actuele, controleerbare gegevens.</p>
      </footer>
    </>
  )
}
