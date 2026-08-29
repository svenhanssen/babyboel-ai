import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute,
  useRouterState,
} from '@tanstack/react-router'
import { useEffect } from 'react'

import interRegular from '@fontsource/inter/files/inter-latin-400-normal.woff2?url'
import { AppShell } from '../ui/app-shell'
import appCss from '../styles.css?url'

const themeScript = `(function(){try{var t=localStorage.getItem('babyboel-theme');if(t==='light'||t==='dark'){document.documentElement.dataset.theme=t}}catch(e){}})()`

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

  useEffect(() => {
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
