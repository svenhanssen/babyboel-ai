import { createFileRoute } from '@tanstack/react-router'

import { trustPageHead, trustPages, TrustPage } from '../public/trust-page'

const page = trustPages.methode

export const Route = createFileRoute('/methode')({
  head: () => trustPageHead(page),
  component: () => <TrustPage page={page} />,
})
