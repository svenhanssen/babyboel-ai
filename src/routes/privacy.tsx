import { createFileRoute } from '@tanstack/react-router'

import { trustPageHead, trustPages, TrustPage } from '../public/trust-page'

const page = trustPages.privacy

export const Route = createFileRoute('/privacy')({
  head: () => trustPageHead(page),
  component: () => <TrustPage page={page} />,
})
