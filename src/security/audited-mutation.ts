import { z } from 'zod'

import { assertTrustedAdminContext, type AdminContext } from './admin-boundary'

type PreparedStatement<Statement> = {
  bind: (...values: unknown[]) => Statement
}

type BatchDatabase<Statement> = {
  prepare: (sql: string) => PreparedStatement<Statement>
  batch: (statements: Statement[]) => Promise<unknown>
}

const auditSummaryBrand: unique symbol = Symbol('SafeAuditSummary')
const unsafeSummaryKey =
  /(authorization|cookie|credential|password|secret|token|assertion|api.?key|private.?key|headers|raw|evidence)/i
const summaryValueSchema = z.union([
  z.string().max(500),
  z.number().finite(),
  z.boolean(),
  z.null(),
])
const summarySchema = z.record(z.string(), summaryValueSchema)

export type SafeAuditSummary = Record<
  string,
  z.infer<typeof summaryValueSchema>
> & {
  readonly [auditSummaryBrand]: true
}

export function createAuditSummary(
  source: Record<string, unknown>,
  includedFields: readonly string[],
): SafeAuditSummary {
  if (includedFields.length === 0 || includedFields.length > 20) {
    throw new Error('AUDIT_SUMMARY_FIELDS_INVALID')
  }

  const summary: Record<string, z.infer<typeof summaryValueSchema>> = {}
  for (const field of includedFields) {
    if (
      unsafeSummaryKey.test(field) ||
      !Object.hasOwn(source, field) ||
      Object.hasOwn(summary, field)
    ) {
      throw new Error('AUDIT_SUMMARY_UNSAFE')
    }
    summary[field] = summaryValueSchema.parse(source[field])
  }

  return Object.defineProperty(summary, auditSummaryBrand, {
    value: true,
  }) as SafeAuditSummary
}

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

type AuditedMutationInput = Omit<
  z.input<typeof auditInputSchema>,
  'actor' | 'before' | 'after'
> & {
  actor: AdminContext
  before: SafeAuditSummary | null
  after: SafeAuditSummary | null
}

const encodeSummary = (summary: SafeAuditSummary | null) => {
  if (summary === null) return null
  if (summary[auditSummaryBrand] !== true) {
    throw new Error('AUDIT_SUMMARY_UNSAFE')
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

  assertTrustedAdminContext(input.actor)
  const audit = auditInputSchema.parse(input)
  if (audit.before === null && audit.after === null) {
    throw new Error('AUDIT_CHANGE_REQUIRED')
  }

  const beforeJson = encodeSummary(input.before)
  const afterJson = encodeSummary(input.after)
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
