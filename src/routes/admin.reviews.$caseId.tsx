import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState, type FormEvent } from 'react'

import { adminServerFnHeaders } from '../admin/client-security'
import { formatAdminDateTime } from '../admin/format'
import { getReviewCaseFn, resolveReviewCaseFn } from '../admin/server-functions'
import { createUuidV7 } from '../db/uuid'

export const Route = createFileRoute('/admin/reviews/$caseId')({
  loader: ({ params }) =>
    getReviewCaseFn({
      data: { caseId: params.caseId },
      headers: adminServerFnHeaders('GET'),
    }),
  component: ReviewDetail,
})

function FactList({ facts }: { facts: Record<string, unknown> }) {
  const entries = Object.entries(facts)
  if (entries.length === 0) {
    return <p className="muted">No retained fields.</p>
  }
  return (
    <dl className="fact-list">
      {entries.map(([name, value]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{String(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

function ReviewDetail() {
  const review = Route.useLoaderData()
  const resolveCase = useServerFn(resolveReviewCaseFn)
  const router = useRouter()
  const [result, setResult] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (!review) {
    return (
      <div className="surface review-detail">
        <h3>Review unavailable</h3>
        <p>The case no longer exists.</p>
      </div>
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!review) return
    const form = new FormData(event.currentTarget)
    const actionValue = form.get('action')
    const packageValue = form.get('packageId')
    const reasonValue = form.get('reason')
    const action = (typeof actionValue === 'string' ? actionValue : '') as
      | 'associate'
      | 'out_of_scope'
      | 'mark_unavailable'
      | 'false_alarm'
      | 'ignore'
      | 'defer'
    const packageId =
      (typeof packageValue === 'string' ? packageValue : '') || undefined
    const reason = typeof reasonValue === 'string' ? reasonValue : ''
    if (
      action !== 'false_alarm' &&
      action !== 'defer' &&
      form.get('confirmed') !== 'yes'
    ) {
      setResult('Confirm the stated publication effect before continuing.')
      return
    }
    setSubmitting(true)
    setResult(null)
    try {
      const response = await resolveCase({
        data: {
          caseId: review.id,
          expectedCaseVersion: review.caseVersion,
          expectedListingUpdatedAt: review.listingUpdatedAt,
          changedAt: Math.max(Date.now(), review.listingUpdatedAt + 1),
          auditId: createUuidV7(),
          action,
          packageId,
          reason,
        },
        headers: adminServerFnHeaders('POST'),
      })
      if (response.status === 'conflict') {
        setResult(
          'This Review changed while you were working. Refresh and review the current facts.',
        )
      } else if (response.status === 'already_resolved') {
        setResult('This Review was already resolved.')
      } else {
        await router.invalidate()
        setResult(
          response.status === 'deferred'
            ? 'Review deferred.'
            : 'Review resolved and audited.',
        )
      }
    } catch {
      setResult('The command failed. No partial change was accepted.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <article aria-labelledby="case-title" className="surface review-detail">
      <header className="review-detail__header">
        <div>
          <p className="eyebrow">
            {review.retailerName} · {review.retailerSku}
          </p>
          <h3 id="case-title">{review.sourceTitle}</h3>
        </div>
        <span className="tag">{review.status}</span>
      </header>
      <p>
        <a href={review.outboundDestination} rel="noreferrer" target="_blank">
          Open exact source page
        </a>
      </p>
      <dl className="summary-grid">
        <div>
          <dt>Why automation stopped</dt>
          <dd>{review.uncertaintyType.replaceAll('_', ' ')}</dd>
        </div>
        <div>
          <dt>Publication effect</dt>
          <dd>
            {review.blocksPublication
              ? 'Blocked until resolved'
              : 'Does not currently block publication'}
          </dd>
        </div>
        <div>
          <dt>Latest observation</dt>
          <dd>
            {review.observedAt
              ? formatAdminDateTime(review.observedAt)
              : 'Unavailable'}
          </dd>
        </div>
        <div>
          <dt>Occurrences</dt>
          <dd>{review.occurrenceCount}</dd>
        </div>
      </dl>
      <section aria-labelledby="evidence-title">
        <h4 id="evidence-title">Sanitized evidence</h4>
        {review.evidenceAvailable ? (
          <>
            <p>{review.sanitizedExcerpt ?? 'No excerpt retained.'}</p>
            <FactList facts={review.normalizedFacts} />
          </>
        ) : (
          <p className="notice">
            Sanitized evidence is unavailable or expired.
          </p>
        )}
      </section>
      <section aria-labelledby="candidates-title">
        <h4 id="candidates-title">Exact Package candidates</h4>
        {review.candidates.length === 0 ? (
          <p>
            No exact candidates. Choose “none of these” with an out-of-scope or
            defer action.
          </p>
        ) : (
          <ul className="candidate-list">
            {review.candidates.map((candidate) => (
              <li key={String(candidate.packageId)}>
                <strong>
                  {String(candidate.brand)} {String(candidate.line ?? '')}{' '}
                  {String(candidate.variant ?? '')}
                </strong>
                <span>
                  {String(candidate.unitCount)} units · GTIN{' '}
                  {String(candidate.gtin ?? 'not verified')} · size{' '}
                  {String(candidate.normalizedSizeCode ?? 'n/a')}
                </span>
                <span className="muted">
                  {candidate.currentAssociation ? 'Current association. ' : ''}
                  {candidate.agreeingFields.length > 0
                    ? `Agrees on ${candidate.agreeingFields.join(', ')}.`
                    : 'No additional exact agreements retained.'}{' '}
                  {candidate.missingCriticalFacts.length > 0
                    ? `Missing ${candidate.missingCriticalFacts.join(', ')}.`
                    : ''}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
      {review.status === 'open' && (
        <form
          className="decision-form"
          onSubmit={(event) => void submit(event)}
        >
          <fieldset>
            <legend>Decision</legend>
            <label>
              <input
                defaultChecked
                name="action"
                type="radio"
                value="associate"
              />{' '}
              Approve association
            </label>
            <label>
              <input name="action" type="radio" value="out_of_scope" /> Mark
              Listing out of scope
            </label>
            <label>
              <input name="action" type="radio" value="mark_unavailable" /> Mark
              Listing unavailable
            </label>
            <label>
              <input name="action" type="radio" value="false_alarm" /> Close as
              false alarm
            </label>
            <label>
              <input name="action" type="radio" value="ignore" /> Ignore this
              Listing
            </label>
            <label>
              <input name="action" type="radio" value="defer" /> Defer
            </label>
          </fieldset>
          <label>
            Package for association
            <select name="packageId">
              <option value="">None of these</option>
              {review.candidates.map((candidate) => (
                <option
                  key={String(candidate.packageId)}
                  value={String(candidate.packageId)}
                >
                  {String(candidate.brand)} · {String(candidate.line ?? '')} ·{' '}
                  {String(candidate.unitCount)} units
                </option>
              ))}
            </select>
          </label>
          <label>
            Controlled reason
            <textarea minLength={10} name="reason" required rows={3} />
          </label>
          <label className="confirmation">
            <input name="confirmed" type="checkbox" value="yes" /> I confirm the
            selected action may change current publication.
          </label>
          <button className="button" disabled={submitting} type="submit">
            {submitting ? 'Applying…' : 'Apply reviewed decision'}
          </button>
          {result && (
            <p aria-live="polite" className="notice" role="status">
              {result}
            </p>
          )}
        </form>
      )}
      <section aria-labelledby="activity-title">
        <h4 id="activity-title">Recent activity</h4>
        <ol className="activity-list">
          {review.activity.map((entry) => (
            <li key={`${entry.kind}-${String(entry.id)}`}>
              <time dateTime={new Date(Number(entry.occurredAt)).toISOString()}>
                {formatAdminDateTime(Number(entry.occurredAt))}
              </time>
              <span>
                {entry.kind === 'decision'
                  ? `${String(entry.action)} — ${String(entry.reason)}`
                  : `${String(entry.outcome)} observation`}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </article>
  )
}
