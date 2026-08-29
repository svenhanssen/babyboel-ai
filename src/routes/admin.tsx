import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin')({
  component: AdminPlaceholder,
})

function AdminPlaceholder() {
  return (
    <main className="admin-page page" id="main" lang="en" tabIndex={-1}>
      <header className="page-heading">
        <div>
          <p className="eyebrow">Operator workspace</p>
          <h1>Protected Admin workspace</h1>
        </div>
        <span className="tag">Protected</span>
      </header>
      <section aria-labelledby="admin-status" className="surface">
        <h2 id="admin-status">Workspace status</h2>
        <p>
          Cloudflare Access verifies the configured operator before this route
          is rendered. Review workflows are delivered separately.
        </p>
        <div className="notice" role="status">
          <strong>The operator boundary is active.</strong>
          <span>
            State-changing requests also require the trusted origin and the
            Admin CSRF token.
          </span>
        </div>
      </section>
    </main>
  )
}
