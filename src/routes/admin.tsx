import { Link, Outlet, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/admin')({
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <main className="admin-page page" id="main" lang="en" tabIndex={-1}>
      <header className="page-heading admin-heading">
        <div>
          <p className="eyebrow">Operator workspace</p>
          <h1>Babyboel Admin</h1>
        </div>
        <span className="tag">Protected</span>
      </header>
      <nav aria-label="Admin navigation" className="admin-nav">
        <Link activeProps={{ 'aria-current': 'page' }} to="/admin">
          Health
        </Link>
        <Link
          activeProps={{ 'aria-current': 'page' }}
          search={{ offset: 0, q: '', status: 'open' }}
          to="/admin/reviews"
        >
          Reviews
        </Link>
        <Link
          activeProps={{ 'aria-current': 'page' }}
          search={{ entityType: 'all', lifecycle: 'all', q: '' }}
          to="/admin/catalog"
        >
          Catalog
        </Link>
      </nav>
      <Outlet />
    </main>
  )
}
