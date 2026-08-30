import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/')({
  component: AdminHome,
})

function AdminHome() {
  return (
    <section aria-labelledby="admin-status" className="surface">
      <h2 id="admin-status">Workspace status</h2>
      <p>
        Use Reviews for uncertain observations and Catalog for focused,
        evidence-backed maintenance. Operational health details remain available
        from the protected health endpoint.
      </p>
      <div className="notice" role="status">
        <strong>The operator boundary is active.</strong>
        <span>
          Every state-changing request requires the trusted origin, CSRF token,
          verified operator, current version, reason, evidence, and audit.
        </span>
      </div>
      <p className="admin-actions">
        <a className="button" href="/admin/reviews">
          Open Reviews
        </a>{' '}
        <a href="/admin/health">View health JSON</a>
      </p>
    </section>
  )
}
