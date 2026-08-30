import { z } from 'zod'

import { deriveAdminHealth } from './service'

const adminHealthInputSchema = z.object({
  now: z.number().int().nonnegative(),
  deploymentId: z.string().min(1).max(200),
  observabilityUrl: z.url(),
})

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')

const displayTime = (timestamp: number | null) =>
  timestamp === null ? 'Not available' : new Date(timestamp).toISOString()

export async function handleAdminHealth(
  database: Env['DB'],
  untrustedInput: z.input<typeof adminHealthInputSchema>,
): Promise<Response> {
  const input = adminHealthInputSchema.parse(untrustedInput)
  const health = await deriveAdminHealth(database, input)
  const retailerRows = health.retailers
    .map((retailer) => {
      const run = retailer.latestRun
      const duration =
        run?.startedAt !== null &&
        run?.startedAt !== undefined &&
        run.finishedAt !== null
          ? `${run.finishedAt - run.startedAt} ms`
          : 'not finished'
      const runSummary = run
        ? `${run.status}; ${duration}; fetched ${run.fetchedCount}, accepted ${run.acceptedCount}, rejected ${run.rejectedCount}, confirmed ${run.confirmedCount}${retailer.latestErrorCode ? `; error ${retailer.latestErrorCode}` : ''}`
        : 'No run'
      return `<tr>
        <th scope="row">${escapeHtml(retailer.name)}</th>
        <td>${escapeHtml(retailer.coverage)}</td>
        <td>${escapeHtml(retailer.health)}</td>
        <td>${retailer.currentOfferCount} current Offer${retailer.currentOfferCount === 1 ? '' : 's'}; oldest freshness boundary ${displayTime(retailer.freshnessBoundaryAt)}</td>
        <td>${escapeHtml(runSummary)}</td>
        <td>${escapeHtml(retailer.sourceAuthorization.status)}; expiry ${displayTime(retailer.sourceAuthorization.expiresAt)}</td>
      </tr>`
    })
    .join('')
  const systemChecks = health.systemChecks
    .map(
      (check) =>
        `<li><strong>${escapeHtml(check.checkKey)}</strong>: ${escapeHtml(check.status)} (${displayTime(check.checkedAt)})${check.safeDetailCode ? ` — ${escapeHtml(check.safeDetailCode)}` : ''}</li>`,
    )
    .join('')

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Operational health — Babyboel</title></head>
<body><main><h1>Operational health</h1>
<p>Derived at ${displayTime(health.checkedAt)} from current D1 facts. Deployment: <code>${escapeHtml(health.deploymentId)}</code>.</p>
<p><a href="${escapeHtml(input.observabilityUrl)}">Open Cloudflare observability</a> for detailed logs and traces.</p>
<section aria-labelledby="retailer-health"><h2 id="retailer-health">Retailers</h2>
<div style="overflow-x:auto"><table><thead><tr><th>Retailer</th><th>Coverage</th><th>Health</th><th>Offers</th><th>Latest run</th><th>Authorization</th></tr></thead><tbody>${retailerRows}</tbody></table></div></section>
<section aria-labelledby="review-health"><h2 id="review-health">Reviews and retention</h2><p>${health.openReviews.count} open Review${health.openReviews.count === 1 ? '' : 's'}; oldest: ${displayTime(health.openReviews.oldestOpenedAt)}.</p><p>${health.evidenceCleanup.pendingCount} evidence artifact${health.evidenceCleanup.pendingCount === 1 ? '' : 's'} due for cleanup.</p></section>
<section aria-labelledby="system-health"><h2 id="system-health">System checks</h2><p>Backup: ${escapeHtml(health.backup.status)} (${displayTime(health.backup.checkedAt)}).</p><ul>${systemChecks || '<li>No application check has reported yet.</li>'}</ul></section>
</main></body></html>`

  return new Response(html, {
    headers: {
      'cache-control': 'private, no-store',
      'content-type': 'text/html; charset=utf-8',
    },
  })
}
