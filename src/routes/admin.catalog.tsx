import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { adminServerFnHeaders } from '../admin/client-security'
import { searchCatalogFn } from '../admin/server-functions'

const searchSchema = z.object({
  q: z.string().catch(''),
  entityType: z.enum(['all', 'product', 'package', 'listing']).catch('all'),
  lifecycle: z.enum(['all', 'active', 'inactive']).catch('all'),
})

export const Route = createFileRoute('/admin/catalog')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    searchCatalogFn({
      data: {
        search: deps.q,
        entityType: deps.entityType,
        lifecycle: deps.lifecycle,
        limit: 30,
      },
      headers: adminServerFnHeaders('GET'),
    }),
  component: CatalogPage,
})

function CatalogPage() {
  const results = Route.useLoaderData()
  const search = Route.useSearch()
  const groups = [
    ['Products', results.products],
    ['Packages', results.packages],
    ['Listings', results.listings],
  ] as const

  return (
    <section aria-labelledby="catalog-title">
      <h2 id="catalog-title">Catalog maintenance</h2>
      <p className="muted">
        Literal search across authoritative Product, Package, and Listing state.
        Physical deletion is never offered.
      </p>
      <form className="filter-bar" method="get" role="search">
        <label>
          Search Catalog
          <input
            defaultValue={search.q}
            name="q"
            placeholder="Name, ID, SKU, or GTIN"
            type="search"
          />
        </label>
        <label>
          Entity
          <select defaultValue={search.entityType} name="entityType">
            <option value="all">All</option>
            <option value="product">Products</option>
            <option value="package">Packages</option>
            <option value="listing">Listings</option>
          </select>
        </label>
        <label>
          Lifecycle
          <select defaultValue={search.lifecycle} name="lifecycle">
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </label>
        <button className="button" type="submit">
          Search
        </button>
      </form>
      <div className="catalog-groups">
        {groups.map(([title, rows]) => (
          <section className="surface" key={title}>
            <h3>
              {title} <span className="tag">{rows.length}</span>
            </h3>
            {rows.length === 0 ? (
              <p>No matching {title.toLowerCase()}.</p>
            ) : (
              <ul className="catalog-results">
                {rows.map((row) => (
                  <li key={String(row.id)}>
                    <div>
                      <strong>
                        {String(row.brand)} {String(row.line ?? '')}{' '}
                        {String(row.variant ?? '')}
                      </strong>
                      <span className="muted">
                        {String(row.identifier)} · {String(row.id)}
                      </span>
                    </div>
                    <span className="tag">{String(row.lifecycle)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
    </section>
  )
}
