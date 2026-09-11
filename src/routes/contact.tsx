import { createFileRoute } from '@tanstack/react-router'

import { trustPageHead, trustPages, TrustPage } from '../public/trust-page'

const page = trustPages.contact

export const Route = createFileRoute('/contact')({
  head: () => trustPageHead(page),
  component: () => <TrustPage page={page} />,
})
