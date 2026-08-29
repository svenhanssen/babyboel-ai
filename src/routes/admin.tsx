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
          <h1>Admin foundation ready</h1>
        </div>
        <span className="tag">Setup</span>
      </header>
      <section aria-labelledby="admin-status" className="surface">
        <h2 id="admin-status">Workspace status</h2>
        <p>
          Authentication and review workflows are deliberately deferred to their
          own tickets.
        </p>
        <div className="notice" role="status">
          <strong>Protected workflows are not active yet.</strong>
          <span>
            This route currently demonstrates the denser Admin presentation
            only.
          </span>
        </div>
      </section>
    </main>
  )
}
