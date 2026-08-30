import { z } from 'zod'

import { currentOfferFreshnessMilliseconds } from '../db/domain'
import { emitOperationalEvent } from './events'

const healthInputSchema = z.object({
  now: z.number().int().nonnegative(),
  deploymentId: z.string().min(1).max(200),
})

type RetailerHealthRow = {
  id: string
  name: string
  lifecycle: 'inactive' | 'active' | 'paused'
  latestRunStatus: 'running' | 'complete' | 'failed' | 'skipped' | null
  latestRunAt: number | null
  latestSuccessfulRunAt: number | null
  latestErrorCode: string | null
  runStartedAt: number | null
  runFinishedAt: number | null
  fetchedCount: number | null
  acceptedCount: number | null
  rejectedCount: number | null
  confirmedCount: number | null
  authorizationStatus:
    'pending' | 'authorized' | 'review_required' | 'revoked' | 'expired' | null
  authorizationExpiresAt: number | null
  currentOfferCount: number
  nearestConfirmationAt: number | null
}

const coverageFor = (lifecycle: RetailerHealthRow['lifecycle']) =>
  lifecycle === 'active'
    ? ('active' as const)
    : lifecycle === 'paused'
      ? ('temporarily_paused' as const)
      : ('not_yet_active' as const)

const retailerHealthFor = (row: RetailerHealthRow, now: number) => {
  if (row.lifecycle === 'inactive') return 'not_active' as const
  if (
    row.authorizationStatus !== 'authorized' ||
    (row.authorizationExpiresAt !== null && row.authorizationExpiresAt <= now)
  ) {
    return 'critical' as const
  }
  if (row.lifecycle !== 'active') return 'paused' as const
  if (
    row.latestSuccessfulRunAt === null ||
    now - row.latestSuccessfulRunAt >= currentOfferFreshnessMilliseconds
  ) {
    return 'critical' as const
  }
  if (
    row.latestRunStatus === 'failed' ||
    row.latestRunStatus === 'skipped' ||
    now - row.latestSuccessfulRunAt >=
      currentOfferFreshnessMilliseconds - 6 * 60 * 60 * 1_000
  ) {
    return 'warning' as const
  }
  return 'healthy' as const
}

export async function deriveAdminHealth(
  database: Env['DB'],
  untrustedInput: z.input<typeof healthInputSchema>,
) {
  const input = healthInputSchema.parse(untrustedInput)
  const freshnessBoundary = input.now - currentOfferFreshnessMilliseconds
  const retailersResult = await database
    .prepare(
      `SELECT
        retailers.id,
        retailers.name,
        retailers.lifecycle,
        retailers.latest_run_status AS latestRunStatus,
        retailers.latest_run_at AS latestRunAt,
        retailers.latest_successful_run_at AS latestSuccessfulRunAt,
        retailers.latest_error_code AS latestErrorCode,
        latest_run.started_at AS runStartedAt,
        latest_run.finished_at AS runFinishedAt,
        latest_run.fetched_count AS fetchedCount,
        latest_run.accepted_count AS acceptedCount,
        latest_run.rejected_count AS rejectedCount,
        latest_run.confirmed_count AS confirmedCount,
        latest_source.authorization_status AS authorizationStatus,
        latest_source.expires_at AS authorizationExpiresAt,
        (
          SELECT COUNT(*)
          FROM offers
          JOIN listings ON listings.id = offers.listing_id
          WHERE listings.retailer_id = retailers.id
            AND listings.match_status = 'matched'
            AND listings.availability = 'available'
            AND listings.confirmed_at >= ?
            AND offers.availability = 'available'
            AND offers.confirmed_at >= ?
            AND (offers.declared_expires_at IS NULL OR offers.declared_expires_at > ?)
        ) AS currentOfferCount,
        (
          SELECT MIN(offers.confirmed_at)
          FROM offers
          JOIN listings ON listings.id = offers.listing_id
          WHERE listings.retailer_id = retailers.id
            AND listings.match_status = 'matched'
            AND listings.availability = 'available'
            AND offers.availability = 'available'
        ) AS nearestConfirmationAt
      FROM retailers
      LEFT JOIN retailer_runs AS latest_run
        ON latest_run.id = (
          SELECT id FROM retailer_runs
          WHERE retailer_id = retailers.id
          ORDER BY started_at DESC, id DESC LIMIT 1
        )
      LEFT JOIN retailer_sources AS latest_source
        ON latest_source.id = coalesce(
          (
            SELECT source_observations.retailer_source_id
            FROM source_observations
            JOIN retailer_runs
              ON retailer_runs.id = source_observations.retailer_run_id
            WHERE retailer_runs.retailer_id = retailers.id
            ORDER BY source_observations.observed_at DESC,
                     source_observations.id DESC
            LIMIT 1
          ),
          (
            SELECT id FROM retailer_sources
            WHERE retailer_id = retailers.id
            ORDER BY updated_at DESC, id DESC
            LIMIT 1
          )
        )
      ORDER BY retailers.name`,
    )
    .bind(freshnessBoundary, freshnessBoundary, input.now)
    .all<RetailerHealthRow>()

  const [reviews, cleanup, backup, checks] = await Promise.all([
    database
      .prepare(
        `SELECT COUNT(*) AS count, MIN(opened_at) AS oldestOpenedAt
         FROM review_cases WHERE status = 'open'`,
      )
      .first<{ count: number; oldestOpenedAt: number | null }>(),
    database
      .prepare(
        `SELECT COUNT(*) AS pendingCount,
                MIN(retention_deadline) AS oldestDeadline
         FROM evidence_artifacts
         WHERE artifact_type = 'raw_response'
           AND deleted_at IS NULL AND retention_deadline <= ?`,
      )
      .bind(input.now)
      .first<{ pendingCount: number; oldestDeadline: number | null }>(),
    database
      .prepare(
        `SELECT status, checked_at AS checkedAt
         FROM system_checks WHERE check_key = 'backup'`,
      )
      .first<{ status: 'ok' | 'warning' | 'failed'; checkedAt: number }>(),
    database
      .prepare(
        `SELECT check_key AS checkKey, status, checked_at AS checkedAt,
                safe_detail_code AS safeDetailCode
         FROM system_checks ORDER BY check_key`,
      )
      .all<{
        checkKey: string
        status: 'ok' | 'warning' | 'failed'
        checkedAt: number
        safeDetailCode: string | null
      }>(),
  ])

  return {
    checkedAt: input.now,
    deploymentId: input.deploymentId,
    retailers: retailersResult.results.map((row) => ({
      id: row.id,
      name: row.name,
      coverage: coverageFor(row.lifecycle),
      health: retailerHealthFor(row, input.now),
      currentOfferCount: row.currentOfferCount,
      freshnessBoundaryAt:
        row.nearestConfirmationAt === null
          ? null
          : row.nearestConfirmationAt + currentOfferFreshnessMilliseconds,
      latestErrorCode: row.latestErrorCode,
      latestRun:
        row.latestRunStatus === null
          ? null
          : {
              status: row.latestRunStatus,
              startedAt: row.runStartedAt,
              finishedAt: row.runFinishedAt,
              fetchedCount: row.fetchedCount ?? 0,
              acceptedCount: row.acceptedCount ?? 0,
              rejectedCount: row.rejectedCount ?? 0,
              confirmedCount: row.confirmedCount ?? 0,
            },
      sourceAuthorization: {
        status:
          row.authorizationStatus === 'authorized' &&
          row.authorizationExpiresAt !== null &&
          row.authorizationExpiresAt <= input.now
            ? ('expired' as const)
            : (row.authorizationStatus ?? 'pending'),
        expiresAt: row.authorizationExpiresAt,
      },
    })),
    openReviews: reviews ?? { count: 0, oldestOpenedAt: null },
    evidenceCleanup: cleanup ?? { pendingCount: 0, oldestDeadline: null },
    backup: backup ?? { status: 'unavailable' as const, checkedAt: null },
    systemChecks: checks.results,
  }
}

export async function handlePublicHealth(
  database: Env['DB'],
): Promise<Response> {
  const headers = {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
  }
  try {
    await database.prepare('SELECT 1 AS alive').first()
    return Response.json(
      { status: 'ok', database: 'ok' },
      { status: 200, headers },
    )
  } catch {
    return Response.json(
      { status: 'unavailable', database: 'unavailable' },
      { status: 503, headers },
    )
  }
}

const cleanupInputSchema = z.object({
  now: z.number().int().nonnegative(),
  limit: z.number().int().min(1).max(100),
})

type EvidenceStore = Pick<Env['EVIDENCE'], 'delete'>

export async function cleanupExpiredEvidence(
  database: Env['DB'],
  evidence: EvidenceStore,
  untrustedInput: z.input<typeof cleanupInputSchema>,
) {
  const input = cleanupInputSchema.parse(untrustedInput)
  const selected = await database
    .prepare(
      `SELECT id, r2_key AS r2Key
       FROM evidence_artifacts
       WHERE artifact_type = 'raw_response'
         AND deleted_at IS NULL AND retention_deadline <= ?
       ORDER BY retention_deadline, id
       LIMIT ?`,
    )
    .bind(input.now, input.limit)
    .all<{ id: string; r2Key: string }>()

  let deleted = 0
  let failed = 0
  for (const artifact of selected.results) {
    try {
      await evidence.delete(artifact.r2Key)
      await database
        .prepare(
          `UPDATE evidence_artifacts SET deleted_at = ?
           WHERE id = ? AND deleted_at IS NULL`,
        )
        .bind(input.now, artifact.id)
        .run()
      deleted += 1
    } catch {
      failed += 1
    }
  }

  return { selected: selected.results.length, deleted, failed }
}

const alertInputSchema = z.object({ now: z.number().int().nonnegative() })
const alertCooldownMilliseconds = 24 * 60 * 60 * 1_000

type OperationalAlertReason =
  | 'retailer_repeated_failure'
  | 'retailer_freshness_at_risk'
  | 'source_authorization_blocked'
  | 'source_authorization_expiring'
  | 'backup_failure'
  | 'evidence_cleanup_failure'
  | 'public_data_safety_risk'

type OperationalAlertFacts = {
  reason: OperationalAlertReason
  errorCode: string | null
}

export type OperationalAlert = OperationalAlertFacts &
  (
    | {
        targetType: 'retailer'
        retailerId: string
        retailerName: string
      }
    | {
        targetType: 'system_check'
        checkKey: string
        checkName: string
      }
  )

export async function collectOperationalAlerts(
  database: Env['DB'],
  untrustedInput: z.input<typeof alertInputSchema>,
): Promise<OperationalAlert[]> {
  const input = alertInputSchema.parse(untrustedInput)
  const rows = await database
    .prepare(
      `SELECT retailers.id, retailers.name,
              retailers.latest_successful_run_at AS latestSuccessfulRunAt,
              retailers.latest_error_code AS latestErrorCode,
              retailers.last_alert_reason AS lastAlertReason,
              retailers.last_alert_at AS lastAlertAt,
              source.authorization_status AS authorizationStatus,
              source.expires_at AS authorizationExpiresAt,
              (
                SELECT COUNT(*) FROM (
                  SELECT status FROM retailer_runs
                  WHERE retailer_id = retailers.id
                  ORDER BY started_at DESC, id DESC LIMIT 2
                ) recent_runs WHERE status = 'failed'
              ) AS recentFailureCount
       FROM retailers
       LEFT JOIN retailer_sources AS source
         ON source.id = coalesce(
           (
             SELECT source_observations.retailer_source_id
             FROM source_observations
             JOIN retailer_runs
               ON retailer_runs.id = source_observations.retailer_run_id
             WHERE retailer_runs.retailer_id = retailers.id
             ORDER BY source_observations.observed_at DESC,
                      source_observations.id DESC
             LIMIT 1
           ),
           (
             SELECT id FROM retailer_sources
             WHERE retailer_id = retailers.id
             ORDER BY updated_at DESC, id DESC
             LIMIT 1
           )
         )
       WHERE retailers.lifecycle = 'active'
       ORDER BY retailers.name`,
    )
    .all<{
      id: string
      name: string
      latestSuccessfulRunAt: number | null
      latestErrorCode: string | null
      lastAlertReason: OperationalAlertReason | null
      lastAlertAt: number | null
      authorizationStatus: string | null
      authorizationExpiresAt: number | null
      recentFailureCount: number
    }>()

  const retailerAlerts = rows.results.flatMap((row) => {
    let reason: OperationalAlertReason | null = null
    if (
      row.authorizationStatus !== 'authorized' ||
      (row.authorizationExpiresAt !== null &&
        row.authorizationExpiresAt <= input.now)
    ) {
      reason = 'source_authorization_blocked'
    } else if (
      row.authorizationExpiresAt !== null &&
      row.authorizationExpiresAt - input.now <= 14 * 24 * 60 * 60 * 1_000
    ) {
      reason = 'source_authorization_expiring'
    } else if (row.recentFailureCount >= 2) {
      reason = 'retailer_repeated_failure'
    } else if (
      row.latestSuccessfulRunAt === null ||
      input.now - row.latestSuccessfulRunAt >=
        currentOfferFreshnessMilliseconds - 6 * 60 * 60 * 1_000
    ) {
      reason = 'retailer_freshness_at_risk'
    }
    if (reason === null) return []
    if (
      row.lastAlertReason === reason &&
      row.lastAlertAt !== null &&
      input.now - row.lastAlertAt < alertCooldownMilliseconds
    ) {
      return []
    }
    return [
      {
        targetType: 'retailer' as const,
        retailerId: row.id,
        retailerName: row.name,
        reason,
        errorCode: row.latestErrorCode,
      },
    ]
  })

  const checks = await database
    .prepare(
      `SELECT check_key AS checkKey, safe_detail_code AS safeDetailCode,
              last_alert_reason AS lastAlertReason,
              last_alert_at AS lastAlertAt
       FROM system_checks
       WHERE status = 'failed'
         AND check_key IN ('backup', 'evidence_cleanup', 'public_data_safety')
       ORDER BY check_key`,
    )
    .all<{
      checkKey: 'backup' | 'evidence_cleanup' | 'public_data_safety'
      safeDetailCode: string | null
      lastAlertReason: OperationalAlertReason | null
      lastAlertAt: number | null
    }>()
  const systemAlerts = checks.results.flatMap((check) => {
    const reason = {
      backup: 'backup_failure',
      evidence_cleanup: 'evidence_cleanup_failure',
      public_data_safety: 'public_data_safety_risk',
    }[check.checkKey] as OperationalAlertReason
    if (
      check.lastAlertReason === reason &&
      check.lastAlertAt !== null &&
      input.now - check.lastAlertAt < alertCooldownMilliseconds
    ) {
      return []
    }
    return [
      {
        targetType: 'system_check' as const,
        checkKey: check.checkKey,
        checkName: check.checkKey.replaceAll('_', ' '),
        reason,
        errorCode: check.safeDetailCode,
      },
    ]
  })

  return [...retailerAlerts, ...systemAlerts]
}

export async function recordOperationalAlert(
  database: Env['DB'],
  alert: OperationalAlert,
  sentAt: number,
): Promise<void> {
  if (alert.targetType === 'retailer') {
    await database
      .prepare(
        `UPDATE retailers SET last_alert_reason = ?, last_alert_at = ?
         WHERE id = ?`,
      )
      .bind(alert.reason, sentAt, alert.retailerId)
      .run()
  } else {
    await database
      .prepare(
        `UPDATE system_checks SET last_alert_reason = ?, last_alert_at = ?
         WHERE check_key = ?`,
      )
      .bind(alert.reason, sentAt, alert.checkKey)
      .run()
  }
}

export async function canAcquireRetailerSource(
  database: Env['DB'],
  retailerSourceId: string,
  now: number,
): Promise<boolean> {
  const result = await database
    .prepare(
      `SELECT 1 AS allowed
       FROM retailers
       JOIN retailer_sources ON retailer_sources.retailer_id = retailers.id
       WHERE retailer_sources.id = ?
         AND retailers.lifecycle = 'active'
         AND retailer_sources.authorization_status = 'authorized'
         AND (retailer_sources.expires_at IS NULL OR retailer_sources.expires_at > ?)
       LIMIT 1`,
    )
    .bind(retailerSourceId, now)
    .first<{ allowed: number }>()
  return result !== null
}

type MaintenanceEnvironment = {
  APP_ENV: 'local' | 'preview' | 'production'
  DB: Env['DB']
  EVIDENCE: EvidenceStore
  OPERATOR_EMAIL: string
  ALERT_FROM_EMAIL: string
  sendEmail: (message: {
    from: string
    to: string
    subject: string
    text: string
  }) => Promise<unknown>
  writeEvent?: (event: Record<string, unknown>) => void
}

const upsertSystemCheck = (
  database: Env['DB'],
  input: {
    key: string
    status: 'ok' | 'warning' | 'failed'
    checkedAt: number
    safeDetailCode: string | null
  },
) =>
  database
    .prepare(
      `INSERT INTO system_checks (
         check_key, status, checked_at, safe_detail_code
       ) VALUES (?, ?, ?, ?)
       ON CONFLICT(check_key) DO UPDATE SET
         status = excluded.status,
         checked_at = excluded.checked_at,
         safe_detail_code = excluded.safe_detail_code`,
    )
    .bind(input.key, input.status, input.checkedAt, input.safeDetailCode)
    .run()

export async function runOperationalMaintenance(
  environment: MaintenanceEnvironment,
  now: number,
) {
  const cleanup = await cleanupExpiredEvidence(
    environment.DB,
    environment.EVIDENCE,
    { now, limit: 50 },
  )
  await upsertSystemCheck(environment.DB, {
    key: 'evidence_cleanup',
    status: cleanup.failed > 0 ? 'failed' : 'ok',
    checkedAt: now,
    safeDetailCode:
      cleanup.failed > 0 ? 'EVIDENCE_DELETE_PARTIAL_FAILURE' : null,
  })
  emitOperationalEvent(
    {
      event:
        cleanup.failed > 0
          ? 'evidence_cleanup_failed'
          : 'evidence_cleanup_completed',
      outcome: cleanup.failed > 0 ? 'failure' : 'success',
      environment: environment.APP_ENV,
      count: cleanup.deleted,
      errorCode:
        cleanup.failed > 0 ? 'EVIDENCE_DELETE_PARTIAL_FAILURE' : undefined,
    },
    environment.writeEvent,
  )

  const alerts = await collectOperationalAlerts(environment.DB, { now })
  for (const alert of alerts) {
    const authorization =
      alert.reason === 'source_authorization_blocked' ||
      alert.reason === 'source_authorization_expiring'
    emitOperationalEvent(
      {
        event: authorization
          ? 'source_authorization_warning'
          : alert.targetType === 'retailer'
            ? 'retailer_coverage_warning'
            : 'system_check_failed',
        outcome: 'failure',
        environment: environment.APP_ENV,
        retailerId:
          alert.targetType === 'retailer' ? alert.retailerId : undefined,
        entityId:
          alert.targetType === 'system_check' ? alert.checkKey : undefined,
        errorCode: alert.reason.toUpperCase(),
      },
      environment.writeEvent,
    )
  }
  let alertsSent = 0
  let alertsFailed = 0

  if (environment.APP_ENV === 'production') {
    for (const alert of alerts) {
      const targetName =
        alert.targetType === 'retailer' ? alert.retailerName : alert.checkName
      try {
        await environment.sendEmail({
          from: environment.ALERT_FROM_EMAIL,
          to: environment.OPERATOR_EMAIL,
          subject: `[Babyboel] ${targetName}: ${alert.reason}`,
          text: [
            `${alert.targetType === 'retailer' ? 'Retailer' : 'System check'}: ${targetName}`,
            `Reason: ${alert.reason}`,
            `Safe error code: ${alert.errorCode ?? 'none'}`,
            'Inspect the protected Admin health page and Cloudflare observability.',
          ].join('\n'),
        })
        await recordOperationalAlert(environment.DB, alert, now)
        emitOperationalEvent(
          {
            event: 'alert_send_completed',
            outcome: 'success',
            environment: environment.APP_ENV,
            retailerId:
              alert.targetType === 'retailer' ? alert.retailerId : undefined,
            entityId:
              alert.targetType === 'system_check' ? alert.checkKey : undefined,
          },
          environment.writeEvent,
        )
        alertsSent += 1
      } catch {
        emitOperationalEvent(
          {
            event: 'alert_send_failed',
            outcome: 'failure',
            environment: environment.APP_ENV,
            retailerId:
              alert.targetType === 'retailer' ? alert.retailerId : undefined,
            entityId:
              alert.targetType === 'system_check' ? alert.checkKey : undefined,
            errorCode: 'ALERT_SEND_FAILED',
          },
          environment.writeEvent,
        )
        alertsFailed += 1
      }
    }
  }

  await upsertSystemCheck(environment.DB, {
    key: 'alert_delivery',
    status: alertsFailed > 0 ? 'failed' : 'ok',
    checkedAt: now,
    safeDetailCode: alertsFailed > 0 ? 'ALERT_SEND_FAILED' : null,
  })

  return { cleanup, alertsSent, alertsFailed }
}
