import { createFileRoute } from '@tanstack/react-router'

import { trustPageHead, trustPages, TrustPage } from '../public/trust-page'

const page = trustPages.dekking

export const Route = createFileRoute('/dekking')({
  head: () => trustPageHead(page),
  component: () => <TrustPage page={page} />,
})
