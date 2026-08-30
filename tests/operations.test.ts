import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cleanupExpiredEvidence,
  canAcquireRetailerSource,
  collectOperationalAlerts,
  deriveAdminHealth,
  handlePublicHealth,
  runOperationalMaintenance,
} from '../src/operations/service'
import { handleAdminHealth } from '../src/operations/http'
import { emitOperationalEvent } from '../src/operations/events'
import { createD1TestDatabase, type D1TestDatabase } from './d1'

const fixturePath = resolve('tests/fixtures/catalog.sql')
const now = 1_787_990_400_000

describe('operational event boundary', () => {
  it('emits only checked low-cardinality fields', () => {
    const write = vi.fn()

    emitOperationalEvent(
      {
        event: 'retailer_run_failed',
        outcome: 'failure',
        environment: 'production',
        deploymentId: 'commit-123',
        requestId: 'request-123',
        retailerId: 'retailer-123',
        durationMs: 42,
        errorCode: 'SOURCE_TIMEOUT',
        authorization: 'Bearer secret',
        payload: { cookie: 'secret' },
      },
      write,
    )

    expect(write).toHaveBeenCalledWith({
      event: 'retailer_run_failed',
      outcome: 'failure',
      environment: 'production',
      deploymentId: 'commit-123',
      requestId: 'request-123',
      retailerId: 'retailer-123',
      durationMs: 42,
      errorCode: 'SOURCE_TIMEOUT',
    })
    expect(JSON.stringify(write.mock.calls)).not.toContain('secret')
  })
})

describe('operational service D1 boundary', () => {
  let database: D1TestDatabase

  beforeEach(async () => {
    database = await createD1TestDatabase()
    await database.executeFile(fixturePath)
  }, 30_000)

  afterEach(async () => {
    await database.close()
  })

  it('derives protected health directly from current operational facts', async () => {
    const health = await deriveAdminHealth(database.binding, {
      now,
      deploymentId: 'commit-123',
    })

    expect(health.deploymentId).toBe('commit-123')
    expect(health.openReviews).toEqual({ count: 1, oldestOpenedAt: now })
    expect(health.retailers).toHaveLength(1)
    expect(health.retailers[0]?.name).toBe('Fixture Retailer')
    expect(health.retailers[0]?.coverage).toBe('active')
    expect(health.retailers[0]?.health).toBe('healthy')
    expect(health.retailers[0]?.currentOfferCount).toBe(1)
    expect(health.retailers[0]?.latestRun?.status).toBe('complete')
    expect(health.retailers[0]?.sourceAuthorization.status).toBe('authorized')
    expect(health.evidenceCleanup.pendingCount).toBe(0)
    expect(health.backup).toEqual({ status: 'unavailable', checkedAt: null })
  })

  it('returns only liveness and minimal D1 status publicly', async () => {
    const response = await handlePublicHealth(database.binding)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: 'ok', database: 'ok' })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('fails public health closed without leaking database detail', async () => {
    const response = await handlePublicHealth({
      prepare: () => ({
        first: () => Promise.reject(new Error('SQL and secret detail')),
      }),
    } as unknown as Env['DB'])

    expect(response.status).toBe(503)
    const body = await response.text()
    expect(JSON.parse(body)).toEqual({
      status: 'unavailable',
      database: 'unavailable',
    })
    expect(body).not.toContain('secret')
  })

  it('deletes expired raw evidence in a bounded, retry-safe cleanup', async () => {
    const cleanupNow = 1_795_766_400_001
    await database.execute(`
      INSERT INTO evidence_artifacts (
        id, retailer_source_id, r2_key, content_hash, artifact_type,
        access_class, stored_at, retention_deadline
      ) VALUES (
        '018f47a0-0000-7000-8000-000000000035',
        '018f47a0-0000-7000-8000-000000000002', 'protected-model-input.json',
        'sha256:protected', 'sanitized_model_input', 'private', ${now},
        ${cleanupNow - 1}
      )
    `)
    const evidence = { delete: vi.fn().mockResolvedValue(undefined) }

    await expect(
      cleanupExpiredEvidence(database.binding, evidence, {
        now: cleanupNow,
        limit: 10,
      }),
    ).resolves.toEqual({ selected: 1, deleted: 1, failed: 0 })
    await expect(
      cleanupExpiredEvidence(database.binding, evidence, {
        now: cleanupNow,
        limit: 10,
      }),
    ).resolves.toEqual({ selected: 0, deleted: 0, failed: 0 })
    expect(evidence.delete).toHaveBeenCalledTimes(1)
    expect(
      await database.execute<{ deletedAt: number }>(`
        SELECT deleted_at AS deletedAt
        FROM evidence_artifacts
        WHERE id = '018f47a0-0000-7000-8000-000000000009'
      `),
    ).toEqual([{ deletedAt: cleanupNow }])
    expect(
      await database.execute<{ deletedAt: number | null }>(`
        SELECT deleted_at AS deletedAt FROM evidence_artifacts
        WHERE id = '018f47a0-0000-7000-8000-000000000035'
      `),
    ).toEqual([{ deletedAt: null }])
    const health = await deriveAdminHealth(database.binding, {
      now: cleanupNow,
      deploymentId: 'commit-123',
    })
    expect(health.evidenceCleanup.pendingCount).toBe(0)
  })

  it('marks only successfully deleted evidence when cleanup partially fails', async () => {
    const cleanupNow = 1_795_766_400_001
    await database.execute(`
      INSERT INTO evidence_artifacts (
        id, retailer_source_id, r2_key, content_hash, artifact_type,
        access_class, stored_at, retention_deadline
      ) VALUES (
        '018f47a0-0000-7000-8000-000000000030',
        '018f47a0-0000-7000-8000-000000000002', 'failure.json',
        'sha256:failure', 'raw_response', 'private', ${now}, ${cleanupNow - 1}
      )
    `)
    const evidence = {
      delete: vi.fn((key: string) => {
        if (key === 'failure.json') {
          return Promise.reject(new Error('R2 unavailable'))
        }
        return Promise.resolve()
      }),
    }

    await expect(
      cleanupExpiredEvidence(database.binding, evidence, {
        now: cleanupNow,
        limit: 10,
      }),
    ).resolves.toEqual({ selected: 2, deleted: 1, failed: 1 })
    expect(
      await database.execute<{ r2Key: string }>(`
        SELECT r2_key AS r2Key FROM evidence_artifacts
        WHERE deleted_at = ${cleanupNow}
      `),
    ).toEqual([{ r2Key: 'fixture-retailer/2026-08-29/response.json' }])
  })

  it('alerts only after repeated failure and deduplicates the same reason', async () => {
    await database.execute(`
      UPDATE retailers
      SET latest_run_status = 'failed', latest_error_code = 'SOURCE_TIMEOUT',
          latest_run_at = ${now}
      WHERE id = '018f47a0-0000-7000-8000-000000000001';
      INSERT INTO retailer_runs (
        id, retailer_id, origin, started_at, finished_at, status,
        error_code, full_traversal
      ) VALUES
        ('018f47a0-0000-7000-8000-000000000031',
         '018f47a0-0000-7000-8000-000000000001', 'scheduled',
         ${now - 2_000}, ${now - 1_000}, 'failed', 'SOURCE_TIMEOUT', 0),
        ('018f47a0-0000-7000-8000-000000000032',
         '018f47a0-0000-7000-8000-000000000001', 'scheduled',
         ${now - 1_000}, ${now}, 'failed', 'SOURCE_TIMEOUT', 0)
    `)

    const first = await collectOperationalAlerts(database.binding, { now })
    expect(first).toEqual([
      expect.objectContaining({
        reason: 'retailer_repeated_failure',
        retailerName: 'Fixture Retailer',
      }),
    ])

    await database.execute(`
      UPDATE retailers
      SET last_alert_reason = 'retailer_repeated_failure',
          last_alert_at = ${now}
      WHERE id = '018f47a0-0000-7000-8000-000000000001'
    `)
    await expect(
      collectOperationalAlerts(database.binding, { now: now + 1_000 }),
    ).resolves.toEqual([])
  })

  it('gates acquisition on both activation and current source authorization', async () => {
    await expect(
      canAcquireRetailerSource(
        database.binding,
        '018f47a0-0000-7000-8000-000000000002',
        now,
      ),
    ).resolves.toBe(true)
    await database.execute(`
      UPDATE retailers SET lifecycle = 'paused'
      WHERE id = '018f47a0-0000-7000-8000-000000000001'
    `)
    await expect(
      canAcquireRetailerSource(
        database.binding,
        '018f47a0-0000-7000-8000-000000000002',
        now,
      ),
    ).resolves.toBe(false)
  })

  it('raises deduplicated backup and public-data safety alerts', async () => {
    await database.execute(`
      INSERT INTO system_checks (
        check_key, status, checked_at, safe_detail_code
      ) VALUES
        ('backup', 'failed', ${now}, 'BACKUP_FAILED'),
        ('public_data_safety', 'failed', ${now}, 'PUBLIC_TRUTH_AT_RISK')
    `)

    const alerts = await collectOperationalAlerts(database.binding, { now })
    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ reason: 'backup_failure' }),
        expect.objectContaining({ reason: 'public_data_safety_risk' }),
      ]),
    )
  })

  it('distinguishes blocked, expiring, and freshness-risk Retailers', async () => {
    await database.execute(`
      INSERT INTO retailer_sources (
        id, retailer_id, source_key, acquisition_method, authorization_status,
        reviewed_at, expires_at, retention_rule_reference, created_at, updated_at
      ) VALUES (
        '018f47a0-0000-7000-8000-000000000036',
        '018f47a0-0000-7000-8000-000000000001', 'unused-authorized-source',
        'feed', 'authorized', ${now}, ${now + 365 * 24 * 60 * 60 * 1_000},
        'unused.md', ${now}, ${now + 1}
      );
      UPDATE retailer_sources SET expires_at = ${now - 1}
      WHERE id = '018f47a0-0000-7000-8000-000000000002'
    `)
    expect(await collectOperationalAlerts(database.binding, { now })).toEqual([
      expect.objectContaining({ reason: 'source_authorization_blocked' }),
    ])
    const events: Record<string, unknown>[] = []
    await runOperationalMaintenance(
      {
        APP_ENV: 'preview',
        DB: database.binding,
        EVIDENCE: { delete: vi.fn().mockResolvedValue(undefined) },
        sendEmail: vi.fn().mockResolvedValue(undefined),
        OPERATOR_EMAIL: 'operator@example.com',
        ALERT_FROM_EMAIL: 'alerts@example.com',
        writeEvent: (event) => events.push(event),
      },
      now,
    )
    expect(events.map(({ event }) => event)).toContain(
      'source_authorization_warning',
    )

    await database.execute(`
      UPDATE retailer_sources SET expires_at = ${now + 24 * 60 * 60 * 1_000}
      WHERE id = '018f47a0-0000-7000-8000-000000000002'
    `)
    expect(await collectOperationalAlerts(database.binding, { now })).toEqual([
      expect.objectContaining({ reason: 'source_authorization_expiring' }),
    ])

    await database.execute(`
      UPDATE retailer_sources SET expires_at = ${now + 365 * 24 * 60 * 60 * 1_000};
      UPDATE retailers
      SET latest_successful_run_at = ${now - 43 * 60 * 60 * 1_000}
      WHERE id = '018f47a0-0000-7000-8000-000000000001'
    `)
    expect(await collectOperationalAlerts(database.binding, { now })).toEqual([
      expect.objectContaining({ reason: 'retailer_freshness_at_risk' }),
    ])
  })

  it('treats an inactive Retailer as expected pre-activation state', async () => {
    await database.execute(`
      UPDATE retailers SET lifecycle = 'inactive'
      WHERE id = '018f47a0-0000-7000-8000-000000000001';
      UPDATE retailer_sources SET authorization_status = 'pending'
      WHERE id = '018f47a0-0000-7000-8000-000000000002'
    `)

    const health = await deriveAdminHealth(database.binding, {
      now,
      deploymentId: 'commit-123',
    })
    expect(health.retailers[0]?.coverage).toBe('not_yet_active')
    expect(health.retailers[0]?.health).toBe('not_active')
  })

  it('sends actionable email only in production and records successful delivery', async () => {
    await database.execute(`
      UPDATE retailers
      SET latest_run_status = 'failed', latest_error_code = 'SOURCE_TIMEOUT',
          latest_run_at = ${now}
      WHERE id = '018f47a0-0000-7000-8000-000000000001';
      INSERT INTO retailer_runs (
        id, retailer_id, origin, started_at, finished_at, status,
        error_code, full_traversal
      ) VALUES
        ('018f47a0-0000-7000-8000-000000000033',
         '018f47a0-0000-7000-8000-000000000001', 'scheduled',
         ${now - 2_000}, ${now - 1_000}, 'failed', 'SOURCE_TIMEOUT', 0),
        ('018f47a0-0000-7000-8000-000000000034',
         '018f47a0-0000-7000-8000-000000000001', 'scheduled',
         ${now - 1_000}, ${now}, 'failed', 'SOURCE_TIMEOUT', 0)
    `)
    const sentMessages: Array<{
      from: string
      to: string
      subject: string
      text: string
    }> = []
    const events: Record<string, unknown>[] = []
    const send = vi.fn(
      (message: (typeof sentMessages)[number]): Promise<void> => {
        sentMessages.push(message)
        return Promise.resolve()
      },
    )
    const evidence = { delete: vi.fn().mockResolvedValue(undefined) }

    await expect(
      runOperationalMaintenance(
        {
          APP_ENV: 'production',
          DB: database.binding,
          EVIDENCE: evidence,
          sendEmail: send,
          OPERATOR_EMAIL: 'operator@example.com',
          ALERT_FROM_EMAIL: 'alerts@example.com',
          writeEvent: (event) => events.push(event),
        },
        now,
      ),
    ).resolves.toEqual(
      expect.objectContaining({ alertsSent: 1, alertsFailed: 0 }),
    )
    expect(send).toHaveBeenCalledOnce()
    expect(sentMessages[0]?.to).toBe('operator@example.com')
    expect(sentMessages[0]?.subject).toContain('Fixture Retailer')
    expect(events.map(({ event }) => event)).toEqual(
      expect.arrayContaining([
        'evidence_cleanup_completed',
        'retailer_coverage_warning',
        'alert_send_completed',
      ]),
    )
    expect(
      await database.execute<{ reason: string }>(`
        SELECT last_alert_reason AS reason FROM retailers
        WHERE id = '018f47a0-0000-7000-8000-000000000001'
      `),
    ).toEqual([{ reason: 'retailer_repeated_failure' }])
  })

  it('renders detailed health as private-safe operator HTML', async () => {
    const response = await handleAdminHealth(database.binding, {
      now,
      deploymentId: 'commit-123',
      observabilityUrl: 'https://dash.cloudflare.com/example/workers',
    })
    const body = await response.text()

    expect(response.status).toBe(200)
    expect(body).toContain('Operational health')
    expect(body).toContain('Fixture Retailer')
    expect(body).toContain('1 current Offer')
    expect(body).toContain('fetched 1, accepted 1, rejected 0, confirmed 1')
    expect(body).toContain('oldest freshness boundary')
    expect(body).toContain('expiry')
    expect(body).toContain('commit-123')
    expect(body).not.toMatch(/rawFacts|sanitizedExcerpt|sourceUrl|Bearer/)
  })

  it('records email failure for Admin without recursively alerting on it', async () => {
    await database.execute(`
      INSERT INTO system_checks (
        check_key, status, checked_at, safe_detail_code
      ) VALUES ('backup', 'failed', ${now}, 'BACKUP_FAILED')
    `)
    const send = vi.fn().mockRejectedValue(new Error('provider secret'))
    const events: Record<string, unknown>[] = []

    await expect(
      runOperationalMaintenance(
        {
          APP_ENV: 'production',
          DB: database.binding,
          EVIDENCE: { delete: vi.fn().mockResolvedValue(undefined) },
          sendEmail: send,
          OPERATOR_EMAIL: 'operator@example.com',
          ALERT_FROM_EMAIL: 'alerts@example.com',
          writeEvent: (event) => events.push(event),
        },
        now,
      ),
    ).resolves.toEqual(
      expect.objectContaining({ alertsSent: 0, alertsFailed: 1 }),
    )
    expect(
      await database.execute<{ status: string; code: string }>(`
        SELECT status, safe_detail_code AS code FROM system_checks
        WHERE check_key = 'alert_delivery'
      `),
    ).toEqual([{ status: 'failed', code: 'ALERT_SEND_FAILED' }])
    expect(events.map(({ event }) => event)).toEqual(
      expect.arrayContaining(['system_check_failed', 'alert_send_failed']),
    )
    expect(JSON.stringify(events)).not.toContain('provider secret')
    await expect(
      collectOperationalAlerts(database.binding, { now }),
    ).resolves.not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ checkKey: 'alert_delivery' }),
      ]),
    )
  })

  it('emits a redacted event when evidence cleanup partially fails', async () => {
    const cleanupNow = 1_795_766_400_001
    const events: Record<string, unknown>[] = []

    const result = await runOperationalMaintenance(
      {
        APP_ENV: 'preview',
        DB: database.binding,
        EVIDENCE: {
          delete: vi.fn().mockRejectedValue(new Error('R2 credential secret')),
        },
        sendEmail: vi.fn().mockResolvedValue(undefined),
        OPERATOR_EMAIL: 'operator@example.com',
        ALERT_FROM_EMAIL: 'alerts@example.com',
        writeEvent: (event) => events.push(event),
      },
      cleanupNow,
    )

    expect(result.cleanup).toEqual({ selected: 1, deleted: 0, failed: 1 })
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: 'evidence_cleanup_failed',
          errorCode: 'EVIDENCE_DELETE_PARTIAL_FAILURE',
        }),
      ]),
    )
    expect(JSON.stringify(events)).not.toContain('credential secret')
  })
})
