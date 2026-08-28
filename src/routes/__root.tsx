import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from '@tanstack/react-router'
import type { ReactNode } from 'react'

import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Babyboel',
      },
      {
        name: 'description',
        content:
          'Vergelijk betrouwbare Nederlandse aanbiedingen voor luiers, luierbroekjes en doekjes.',
      },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
})

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  )
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="nl">
      <head>
        <HeadContent />
      </head>
      <body>
        <a className="skip-link" href="#main">
          Naar hoofdinhoud
        </a>
        <header>
          <nav aria-label="Hoofdnavigatie">
            <Link to="/">Babyboel</Link>
            <Link to="/admin">Admin</Link>
          </nav>
        </header>
        {children}
        <Scripts />
      </body>
    </html>
  )
}
