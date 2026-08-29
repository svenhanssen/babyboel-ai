import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  createApplicationSecurityBoundary,
  requireAdminContext,
  type AdminContext,
  type SecurityEnvironment,
} from '../src/security/admin-boundary'
import {
  commitAuditedMutation,
  createAuditSummary,
  type SafeAuditSummary,
} from '../src/security/audited-mutation'

type BoundStatement = {
  sql: string
  values: unknown[]
}

class TransactionalDatabase {
  state = 'before'
  auditRows: Record<string, unknown>[] = []
  failMutation = false

  prepare(sql: string) {
    return {
      bind: (...values: unknown[]): BoundStatement => ({ sql, values }),
    }
  }

  batch(statements: BoundStatement[]) {
    const nextAuditRows = [...this.auditRows]

    if (this.failMutation) {
      return Promise.reject(new Error('mutation failed'))
    }

    for (const statement of statements) {
      if (statement.sql === 'UPDATE target') {
        this.state = 'after'
      }
      if (statement.sql.includes('INSERT INTO audit_log')) {
        nextAuditRows.push({ values: statement.values })
      }
    }

    this.auditRows = nextAuditRows
    return Promise.resolve(statements.map(() => ({ success: true })))
  }
}

type MutationInput = Parameters<typeof commitAuditedMutation>[2]

let input: MutationInput

describe('audited Admin mutations', () => {
  beforeAll(async () => {
    let actor: AdminContext | undefined
    const boundary = createApplicationSecurityBoundary(
      (request) => {
        actor = requireAdminContext(request)
        return new Response('ok')
      },
      { generateRequestId: () => 'request-123' },
    )
    const environment: SecurityEnvironment = {
      APP_ENV: 'local',
      ACCESS_TEAM_DOMAIN: 'local.invalid',
      ACCESS_AUD: 'local-unused',
      ACCESS_OPERATOR_SUBJECT: 'local-operator',
      TRUSTED_ORIGIN: 'http://localhost:3000',
    }

    await boundary(
      new Request('http://localhost:3000/admin', {
        headers: { 'X-Babyboel-Local-Actor': 'local-operator' },
      }),
      environment,
    )
    if (!actor) throw new Error('Unable to establish Admin context')

    input = {
      actor,
      auditId: '018f47a0-0000-7000-8000-000000000099',
      occurredAt: 1_787_990_400_000,
      action: 'listing.correct',
      reason: 'Correct an observed catalog fact',
      target: {
        type: 'listing',
        id: '018f47a0-0000-7000-8000-000000000006',
      },
      before: createAuditSummary({ availability: 'unknown' }, ['availability']),
      after: createAuditSummary({ availability: 'available' }, [
        'availability',
      ]),
    }
  })

  it('commits the state change and compact audit fact in one batch', async () => {
    const database = new TransactionalDatabase()
    const mutation = database.prepare('UPDATE target').bind()

    await commitAuditedMutation(database, [mutation], input)

    expect(database.state).toBe('after')
    expect(database.auditRows).toHaveLength(1)
    expect(database.auditRows[0]?.values).toEqual([
      input.auditId,
      input.actor.actorId,
      input.occurredAt,
      input.action,
      input.reason,
      input.target.type,
      input.target.id,
      JSON.stringify(input.before),
      JSON.stringify(input.after),
      input.actor.requestId,
    ])
  })

  it('does not leave a success audit when the mutation fails', async () => {
    const database = new TransactionalDatabase()
    database.failMutation = true

    await expect(
      commitAuditedMutation(
        database,
        [database.prepare('UPDATE target').bind()],
        input,
      ),
    ).rejects.toThrow('mutation failed')

    expect(database.state).toBe('before')
    expect(database.auditRows).toEqual([])
  })

  it('rejects oversized summaries before touching the database', async () => {
    const database = new TransactionalDatabase()
    const batch = vi.spyOn(database, 'batch')
    const fields = Array.from({ length: 10 }, (_, index) => `field${index}`)
    const source = Object.fromEntries(
      fields.map((field) => [field, 'x'.repeat(500)]),
    )

    await expect(
      commitAuditedMutation(
        database,
        [database.prepare('UPDATE target').bind()],
        {
          ...input,
          after: createAuditSummary(source, fields),
        },
      ),
    ).rejects.toThrow('AUDIT_SUMMARY_TOO_LARGE')

    expect(batch).not.toHaveBeenCalled()
  })

  it('rejects secret-bearing audit summaries before touching the database', () => {
    const database = new TransactionalDatabase()
    const batch = vi.spyOn(database, 'batch')

    expect(() =>
      createAuditSummary({ evidence: '<retained retailer response>' }, [
        'evidence',
      ]),
    ).toThrow('AUDIT_SUMMARY_UNSAFE')

    expect(batch).not.toHaveBeenCalled()
  })

  it('rejects an untrusted summary object at the transaction boundary', async () => {
    const database = new TransactionalDatabase()

    await expect(
      commitAuditedMutation(
        database,
        [database.prepare('UPDATE target').bind()],
        {
          ...input,
          after: {
            availability: 'available',
          } as unknown as SafeAuditSummary,
        },
      ),
    ).rejects.toThrow('AUDIT_SUMMARY_UNSAFE')
  })

  it('requires at least one state-changing statement', async () => {
    const database = new TransactionalDatabase()

    await expect(commitAuditedMutation(database, [], input)).rejects.toThrow(
      'AUDITED_MUTATION_REQUIRED',
    )
    expect(database.auditRows).toEqual([])
  })
})
