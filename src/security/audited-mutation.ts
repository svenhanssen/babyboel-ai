import { z } from 'zod'

import type { AdminContext } from './admin-boundary'

type PreparedStatement<Statement> = {
  bind: (...values: unknown[]) => Statement
}

type BatchDatabase<Statement> = {
  prepare: (sql: string) => PreparedStatement<Statement>
  batch: (statements: Statement[]) => Promise<unknown>
}

const summarySchema = z.record(z.string(), z.unknown())
const auditInputSchema = z.object({
  actor: z.object({
    actorId: z.string().min(1).max(200),
    requestId: z.string().min(1).max(100),
  }),
  auditId: z
    .string()
    .regex(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    ),
  occurredAt: z.number().int().nonnegative(),
  action: z.string().min(1).max(100),
  reason: z.string().min(1).max(500),
  target: z.object({
    type: z.string().min(1).max(100),
    id: z.string().min(1).max(200),
  }),
  before: summarySchema.nullable(),
  after: summarySchema.nullable(),
})

type AuditedMutationInput = {
  actor: AdminContext
  auditId: string
  occurredAt: number
  action: string
  reason: string
  target: {
    type: string
    id: string
  }
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
}

const encodeSummary = (summary: Record<string, unknown> | null) => {
  if (summary === null) return null

  const unsafeKey =
    /(authorization|cookie|credential|password|secret|token|assertion|api.?key|private.?key|headers|raw.?body)/i
  const pending: unknown[] = [summary]
  const visited = new WeakSet<object>()
  while (pending.length > 0) {
    const value = pending.pop()
    if (!value || typeof value !== 'object') continue
    if (visited.has(value)) throw new Error('AUDIT_SUMMARY_UNSAFE')
    visited.add(value)

    for (const [key, nested] of Object.entries(value)) {
      if (unsafeKey.test(key)) throw new Error('AUDIT_SUMMARY_UNSAFE')
      if (nested && typeof nested === 'object') pending.push(nested)
    }
  }

  const encoded = JSON.stringify(summary)
  if (new TextEncoder().encode(encoded).byteLength > 4_096) {
    throw new Error('AUDIT_SUMMARY_TOO_LARGE')
  }
  return encoded
}

export async function commitAuditedMutation<Statement>(
  database: BatchDatabase<Statement>,
  mutationStatements: Statement[],
  input: AuditedMutationInput,
): Promise<void> {
  if (mutationStatements.length === 0) {
    throw new Error('AUDITED_MUTATION_REQUIRED')
  }

  const audit = auditInputSchema.parse(input)
  if (audit.before === null && audit.after === null) {
    throw new Error('AUDIT_CHANGE_REQUIRED')
  }

  const beforeJson = encodeSummary(audit.before)
  const afterJson = encodeSummary(audit.after)
  const auditStatement = database
    .prepare(
      `INSERT INTO audit_log (
        id, actor, occurred_at, action, reason, target_type, target_id,
        before_json, after_json, correlation_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      audit.auditId,
      audit.actor.actorId,
      audit.occurredAt,
      audit.action,
      audit.reason,
      audit.target.type,
      audit.target.id,
      beforeJson,
      afterJson,
      audit.actor.requestId,
    )

  await database.batch([...mutationStatements, auditStatement])
}
