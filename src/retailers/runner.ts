import { applyCompleteTraversalMisses } from '../catalog/ingestion'
import { createUuidV7 } from '../db/uuid'
import { canAcquireRetailerSource } from '../operations/service'
import { emitOperationalEvent } from '../operations/events'
import {
  parseRetailerAdapterResult,
  type RetailerAdapterResult,
} from './contract'
import { persistAdapterSnapshot } from './persist'
import { adapterForSourceKey } from './registry'
import { createFixtureFetch, syntheticFeedUrl, syntheticFeeds } from './harness'
import { syntheticAdapterIdentifier } from './synthetic'

const leaseTtlMilliseconds = 10 * 60 * 1_000
const syntheticItemCap = 500
const syntheticByteCap = 1_024 * 1_024

type AcquisitionMode = 'disabled' | 'fixture' | 'live'
type RunOrigin = 'scheduled' | 'manual'
type AppEnvironment = 'local' | 'preview' | 'production'

export type RetailerRunSummary = {
  retailerId: string
  runId: string | null
  status: 'complete' | 'failed' | 'skipped'
  fullTraversal: boolean
  errorCode: string | null
  fetchedCount: number
  acceptedCount: number
  rejectedCount: number
  confirmedCount: number
}

const sleep = async (milliseconds: number) => {
  await new Promise((resolve) => setTimeout(resolve, milliseconds))
}

type RunEnvironment = {
  database: Env['DB']
  now: number
  origin: RunOrigin
  mode: AcquisitionMode
  environment: AppEnvironment
  createId?: () => string
  fixtureFetch?: typeof globalThis.fetch
  writeEvent?: (event: Record<string, unknown>) => void
}

type RetailerRow = {
  id: string
  slug: string
  lifecycle: 'inactive' | 'active' | 'paused'
  leaseToken: string | null
  leaseExpiresAt: number | null
  sourceId: string | null
  sourceKey: string | null
}

const finishRun = async (
  environment: RunEnvironment,
  input: {
    retailerId: string
    runId: string
    leaseToken: string
    status: 'complete' | 'failed' | 'skipped'
    fullTraversal: boolean
    errorCode: string | null
    fetchedCount: number
    acceptedCount: number
    rejectedCount: number
    confirmedCount: number
  },
) => {
  await environment.database
    .prepare(
      `UPDATE retailer_runs
       SET finished_at = ?, status = ?, fetched_count = ?, accepted_count = ?,
         rejected_count = ?, confirmed_count = ?, error_code = ?,
         error_message = ?, full_traversal = ?
       WHERE id = ?`,
    )
    .bind(
      environment.now,
      input.status,
      input.fetchedCount,
      input.acceptedCount,
      input.rejectedCount,
      input.confirmedCount,
      input.errorCode,
      input.errorCode,
      input.fullTraversal ? 1 : 0,
      input.runId,
    )
    .run()
  await environment.database
    .prepare(
      `UPDATE retailers
       SET lease_token = NULL, lease_expires_at = NULL,
         latest_run_status = ?, latest_run_at = ?,
         latest_successful_run_at = CASE WHEN ? = 1 THEN ? ELSE latest_successful_run_at END,
         latest_error_code = ?, updated_at = ?
       WHERE id = ? AND lease_token = ?`,
    )
    .bind(
      input.status,
      environment.now,
      input.status === 'complete' && input.fullTraversal ? 1 : 0,
      environment.now,
      input.errorCode,
      environment.now,
      input.retailerId,
      input.leaseToken,
    )
    .run()
  emitOperationalEvent(
    {
      event:
        input.status === 'failed'
          ? 'retailer_run_failed'
          : 'retailer_run_completed',
      outcome: input.status === 'failed' ? 'failure' : 'success',
      environment: environment.environment,
      retailerId: input.retailerId,
      runId: input.runId,
      errorCode: input.errorCode ?? undefined,
    },
    environment.writeEvent,
  )
  return {
    retailerId: input.retailerId,
    runId: input.runId,
    status: input.status,
    fullTraversal: input.fullTraversal,
    errorCode: input.errorCode,
    fetchedCount: input.fetchedCount,
    acceptedCount: input.acceptedCount,
    rejectedCount: input.rejectedCount,
    confirmedCount: input.confirmedCount,
  } satisfies RetailerRunSummary
}

const skipRetailer = async (
  environment: RunEnvironment,
  retailerId: string,
  errorCode: string,
): Promise<RetailerRunSummary> => {
  const createId = environment.createId ?? createUuidV7
  const runId = createId()
  await environment.database
    .prepare(
      `INSERT INTO retailer_runs (
        id, retailer_id, origin, started_at, finished_at, status,
        fetched_count, accepted_count, rejected_count, confirmed_count,
        error_code, error_message, full_traversal
      ) VALUES (?, ?, ?, ?, ?, 'skipped', 0, 0, 0, 0, ?, ?, 0)`,
    )
    .bind(
      runId,
      retailerId,
      environment.origin,
      environment.now,
      environment.now,
      errorCode,
      errorCode,
    )
    .run()
  await environment.database
    .prepare(
      `UPDATE retailers
       SET latest_run_status = 'skipped', latest_run_at = ?,
         latest_error_code = ?, updated_at = ?
       WHERE id = ?`,
    )
    .bind(environment.now, errorCode, environment.now, retailerId)
    .run()
  return {
    retailerId,
    runId,
    status: 'skipped',
    fullTraversal: false,
    errorCode,
    fetchedCount: 0,
    acceptedCount: 0,
    rejectedCount: 0,
    confirmedCount: 0,
  }
}

export async function runRetailerAcquisition(
  environment: RunEnvironment,
  retailer: RetailerRow,
): Promise<RetailerRunSummary> {
  if (environment.mode === 'disabled') {
    return skipRetailer(environment, retailer.id, 'GLOBAL_KILL_SWITCH')
  }
  if (retailer.lifecycle !== 'active') {
    return skipRetailer(environment, retailer.id, 'RETAILER_KILL_SWITCH')
  }
  if (
    retailer.sourceId === null ||
    retailer.sourceKey === null ||
    !(await canAcquireRetailerSource(
      environment.database,
      retailer.sourceId,
      environment.now,
    ))
  ) {
    return skipRetailer(environment, retailer.id, 'SOURCE_UNAUTHORIZED')
  }
  const adapter = adapterForSourceKey(retailer.sourceKey)
  if (adapter === undefined || environment.mode !== 'fixture') {
    return skipRetailer(environment, retailer.id, 'ADAPTER_UNAVAILABLE')
  }

  const createId = environment.createId ?? createUuidV7
  const leaseToken = createId()
  const claimed = await environment.database
    .prepare(
      `UPDATE retailers
       SET lease_token = ?, lease_expires_at = ?, updated_at = ?
       WHERE id = ?
         AND (lease_token IS NULL OR lease_expires_at <= ?)
       RETURNING id`,
    )
    .bind(
      leaseToken,
      environment.now + leaseTtlMilliseconds,
      environment.now,
      retailer.id,
      environment.now,
    )
    .first<{ id: string }>()
  if (!claimed) {
    return skipRetailer(environment, retailer.id, 'LEASE_HELD')
  }
  await environment.database
    .prepare(
      `UPDATE retailer_runs
       SET status = 'failed', finished_at = ?, error_code = 'LEASE_EXPIRED',
         error_message = 'LEASE_EXPIRED'
       WHERE retailer_id = ? AND status = 'running'`,
    )
    .bind(environment.now, retailer.id)
    .run()

  const runId = createId()
  await environment.database
    .prepare(
      `INSERT INTO retailer_runs (
        id, retailer_id, origin, started_at, status, fetched_count,
        accepted_count, rejected_count, confirmed_count, full_traversal
      ) VALUES (?, ?, ?, ?, 'running', 0, 0, 0, 0, 0)`,
    )
    .bind(runId, retailer.id, environment.origin, environment.now)
    .run()
  emitOperationalEvent(
    {
      event: 'retailer_run_started',
      outcome: 'success',
      environment: environment.environment,
      retailerId: retailer.id,
      runId,
    },
    environment.writeEvent,
  )

  const fetch =
    environment.fixtureFetch ??
    createFixtureFetch({ [syntheticFeedUrl]: syntheticFeeds.normal })
  let result: RetailerAdapterResult
  try {
    result = parseRetailerAdapterResult(
      await adapter({
        sourceKey: retailer.sourceKey,
        sellerKey: retailer.slug,
        observedAt: environment.now,
        maxItems: syntheticItemCap,
        fetch: {
          url: syntheticFeedUrl,
          allowedHosts: ['synthetic.babyboel.test'],
          timeoutMs: 5_000,
          maxBytes: syntheticByteCap,
          maxRedirects: 3,
          allowedContentTypes: ['application/json'],
          maxRetries: 2,
          fetch,
          sleep,
        },
      }),
    )
  } catch {
    return finishRun(environment, {
      retailerId: retailer.id,
      runId,
      leaseToken,
      status: 'failed',
      fullTraversal: false,
      errorCode: 'ADAPTER_FAILED',
      fetchedCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      confirmedCount: 0,
    })
  }

  if (result.issueCodes.includes('SOURCE_UNAUTHORIZED')) {
    return finishRun(environment, {
      retailerId: retailer.id,
      runId,
      leaseToken,
      status: 'failed',
      fullTraversal: false,
      errorCode: 'SOURCE_UNAUTHORIZED',
      fetchedCount: 0,
      acceptedCount: 0,
      rejectedCount: 0,
      confirmedCount: 0,
    })
  }

  let acceptedCount = 0
  let rejectedCount = 0
  let confirmedCount = 0
  for (const snapshot of result.snapshots) {
    try {
      const persisted = await persistAdapterSnapshot(environment, {
        retailerId: retailer.id,
        retailerSlug: retailer.slug,
        sourceId: retailer.sourceId,
        runId,
        result,
        snapshot,
      })
      if (persisted.accepted) acceptedCount += 1
      else rejectedCount += 1
      if (persisted.confirmed) confirmedCount += 1
    } catch {
      rejectedCount += 1
    }
  }

  const failedFetch =
    result.snapshots.length === 0 && result.traversal === 'incomplete'
  if (failedFetch && result.issueCodes.length > 0) {
    return finishRun(environment, {
      retailerId: retailer.id,
      runId,
      leaseToken,
      status: 'failed',
      fullTraversal: false,
      errorCode: result.issueCodes[0] ?? 'ADAPTER_FAILED',
      fetchedCount: result.snapshots.length,
      acceptedCount,
      rejectedCount,
      confirmedCount,
    })
  }

  if (result.traversal === 'complete') {
    await applyCompleteTraversalMisses(environment.database, {
      retailerId: retailer.id,
      presentListingKeys: result.snapshots.map(
        (snapshot) => snapshot.sourceListingKey,
      ),
      observedAt: environment.now,
    })
  }

  return finishRun(environment, {
    retailerId: retailer.id,
    runId,
    leaseToken,
    status: 'complete',
    fullTraversal: result.traversal === 'complete',
    errorCode: result.issueCodes[0] ?? null,
    fetchedCount: result.snapshots.length,
    acceptedCount,
    rejectedCount,
    confirmedCount,
  })
}

export async function runScheduledRetailers(
  environment: RunEnvironment,
): Promise<RetailerRunSummary[]> {
  const rows = await environment.database
    .prepare(
      `SELECT retailers.id, retailers.slug, retailers.lifecycle,
        retailers.lease_token AS leaseToken,
        retailers.lease_expires_at AS leaseExpiresAt,
        (
          SELECT id FROM retailer_sources
          WHERE retailer_id = retailers.id
          ORDER BY updated_at DESC, id DESC LIMIT 1
        ) AS sourceId,
        (
          SELECT source_key FROM retailer_sources
          WHERE retailer_id = retailers.id
          ORDER BY updated_at DESC, id DESC LIMIT 1
        ) AS sourceKey
       FROM retailers
       ORDER BY retailers.slug, retailers.id`,
    )
    .all<RetailerRow>()

  const summaries: RetailerRunSummary[] = []
  for (const retailer of rows.results) {
    summaries.push(await runRetailerAcquisition(environment, retailer))
  }
  return summaries
}

export { syntheticAdapterIdentifier, syntheticFeedUrl }
