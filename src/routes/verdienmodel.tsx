import { createFileRoute } from '@tanstack/react-router'

import { trustPageHead, trustPages, TrustPage } from '../public/trust-page'

const page = trustPages.verdienmodel

export const Route = createFileRoute('/verdienmodel')({
  head: () => trustPageHead(page),
  component: () => <TrustPage page={page} />,
})
