import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect, useRef } from 'react'

import interRegular from '@fontsource/inter/files/inter-latin-400-normal.woff2?url'
import interSemibold from '@fontsource/inter/files/inter-latin-600-normal.woff2?url'
import fredokaSemibold from '@fontsource/fredoka/files/fredoka-latin-600-normal.woff2?url'
import { AppShell } from '../ui/app-shell'
import { themeScript } from '../ui/theme'
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
      { name: 'theme-color', content: '#fffaf5' },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      {
        rel: 'preload',
        href: interRegular,
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'preload',
        href: fredokaSemibold,
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'preload',
        href: interSemibold,
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      { rel: 'stylesheet', href: appCss },
    ],
  }),
  component: RootComponent,
})

function RootComponent() {
  return <RootDocument />
}

function RouteFocusManager() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const previousPathname = useRef(pathname)

  useEffect(() => {
    if (pathname === previousPathname.current) return

    previousPathname.current = pathname
    document.querySelector<HTMLElement>('main')?.focus({ preventScroll: true })
  }, [pathname])

  return null
}

function RootDocument() {
  return (
    <html lang="nl">
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <HeadContent />
      </head>
      <body>
        <AppShell>
          <RouteFocusManager />
          <Outlet />
        </AppShell>
        <Scripts />
      </body>
    </html>
  )
}
