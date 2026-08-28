import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin')({
  component: AdminPlaceholder,
})

function AdminPlaceholder() {
  return (
    <main id="main" lang="en">
      <p className="eyebrow">Operator workspace</p>
      <h1>Admin foundation ready</h1>
      <p>
        Authentication and review workflows are deliberately deferred to their
        own tickets.
      </p>
    </main>
  )
}
