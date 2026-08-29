import { describe, expect, it, vi } from 'vitest'

import { commitAuditedMutation } from '../src/security/audited-mutation'

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

const input = {
  actor: {
    actorId: 'github|operator',
    requestId: 'request-123',
  },
  auditId: '018f47a0-0000-7000-8000-000000000099',
  occurredAt: 1_787_990_400_000,
  action: 'listing.correct',
  reason: 'Correct an observed catalog fact',
  target: {
    type: 'listing',
    id: '018f47a0-0000-7000-8000-000000000006',
  },
  before: { availability: 'unknown' },
  after: { availability: 'available' },
}

describe('audited Admin mutations', () => {
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

    await expect(
      commitAuditedMutation(
        database,
        [database.prepare('UPDATE target').bind()],
        {
          ...input,
          after: { unsafe: 'x'.repeat(5_000) },
        },
      ),
    ).rejects.toThrow('AUDIT_SUMMARY_TOO_LARGE')

    expect(batch).not.toHaveBeenCalled()
  })

  it('rejects secret-bearing audit summaries before touching the database', async () => {
    const database = new TransactionalDatabase()
    const batch = vi.spyOn(database, 'batch')

    await expect(
      commitAuditedMutation(
        database,
        [database.prepare('UPDATE target').bind()],
        {
          ...input,
          after: { access_token: 'must-not-be-persisted' },
        },
      ),
    ).rejects.toThrow('AUDIT_SUMMARY_UNSAFE')

    expect(batch).not.toHaveBeenCalled()
  })

  it('requires at least one state-changing statement', async () => {
    const database = new TransactionalDatabase()

    await expect(commitAuditedMutation(database, [], input)).rejects.toThrow(
      'AUDITED_MUTATION_REQUIRED',
    )
    expect(database.auditRows).toEqual([])
  })
})
