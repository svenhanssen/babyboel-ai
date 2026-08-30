import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

import { adminServerFnHeaders } from '../admin/client-security'
import { formatAdminDateTime } from '../admin/format'
import { getReviewQueueFn } from '../admin/server-functions'

const emptyOptionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
)
const optionalUuid = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    )
    .optional(),
)

const searchSchema = z.object({
  status: z.enum(['open', 'closed']).catch('open'),
  retailerId: optionalUuid,
  uncertaintyType: emptyOptionalString,
  q: z.string().catch(''),
  offset: z.coerce.number().int().min(0).catch(0),
})

export const Route = createFileRoute('/admin/reviews')({
  validateSearch: searchSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) =>
    getReviewQueueFn({
      data: {
        status: deps.status,
        retailerId: deps.retailerId,
        uncertaintyType: deps.uncertaintyType,
        search: deps.q,
        offset: deps.offset,
        limit: 24,
      },
      headers: adminServerFnHeaders('GET'),
    }),
  component: ReviewsWorkspace,
})

function ReviewsWorkspace() {
  const queue = Route.useLoaderData()
  const search = Route.useSearch()

  return (
    <section aria-labelledby="reviews-title">
      <div className="section-heading">
        <div>
          <h2 id="reviews-title">Reviews</h2>
          <p className="muted">
            Resolve uncertain Listing-to-Package work without exposing raw
            acquisition evidence.
          </p>
        </div>
        <div aria-label="Review counts" className="count-list">
          <span>
            <strong>{queue.counts.openCount}</strong> open
          </span>
          <span>
            <strong>{queue.counts.closedCount}</strong> closed
          </span>
        </div>
      </div>
      <form className="filter-bar" method="get" role="search">
        <label>
          Search Reviews
          <input
            defaultValue={search.q}
            name="q"
            placeholder="SKU, title, or case ID"
            type="search"
          />
        </label>
        <label>
          Status
          <select defaultValue={search.status} name="status">
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
        </label>
        <label>
          Retailer ID
          <input
            defaultValue={search.retailerId}
            name="retailerId"
            placeholder="Exact retailer UUID"
          />
        </label>
        <label>
          Uncertainty type
          <input
            defaultValue={search.uncertaintyType}
            name="uncertaintyType"
            placeholder="e.g. identity_conflict"
          />
        </label>
        <button className="button" type="submit">
          Apply filters
        </button>
      </form>
      <div className="review-workspace">
        <div aria-label="Review queue" className="review-queue">
          {queue.cases.length === 0 ? (
            <div className="surface empty-state" role="status">
              <h3>No Reviews found</h3>
              <p>The current filters have no matching cases.</p>
            </div>
          ) : (
            <ol className="review-list">
              {queue.cases.map((review) => (
                <li key={review.id}>
                  <Link
                    className="review-card"
                    params={{ caseId: review.id }}
                    search={search}
                    to="/admin/reviews/$caseId"
                  >
                    <span className="review-card__topline">
                      <strong>{review.retailerName}</strong>
                      <span className="tag">
                        {review.blocksPublication
                          ? 'Blocks publication'
                          : review.status}
                      </span>
                    </span>
                    <span>{review.sourceTitle}</span>
                    <span className="muted">
                      {review.retailerSku} ·{' '}
                      {review.uncertaintyType.replaceAll('_', ' ')}
                    </span>
                    <span className="muted">
                      Opened {formatAdminDateTime(review.openedAt)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
          {queue.total > queue.limit && (
            <nav aria-label="Review pages" className="pagination">
              {queue.offset > 0 ? (
                <Link
                  search={{
                    ...search,
                    offset: Math.max(0, queue.offset - queue.limit),
                  }}
                  to="/admin/reviews"
                >
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span>
                {queue.offset + 1}–
                {Math.min(queue.offset + queue.limit, queue.total)} of{' '}
                {queue.total}
              </span>
              {queue.offset + queue.limit < queue.total && (
                <Link
                  search={{ ...search, offset: queue.offset + queue.limit }}
                  to="/admin/reviews"
                >
                  Next
                </Link>
              )}
            </nav>
          )}
        </div>
        <Outlet />
      </div>
    </section>
  )
}
