import { z } from 'zod'

const operationalEventSchema = z.object({
  event: z.enum([
    'operational_error',
    'retailer_run_started',
    'retailer_run_completed',
    'retailer_run_failed',
    'retailer_coverage_warning',
    'source_authorization_warning',
    'system_check_failed',
    'admin_mutation_completed',
    'admin_mutation_failed',
    'deployment_completed',
    'deployment_failed',
    'evidence_cleanup_completed',
    'evidence_cleanup_failed',
    'alert_send_completed',
    'alert_send_failed',
  ]),
  outcome: z.enum(['success', 'failure', 'skipped']),
  environment: z.enum(['local', 'preview', 'production']),
  deploymentId: z.string().min(1).max(200).optional(),
  requestId: z.string().min(1).max(200).optional(),
  runId: z.string().min(1).max(200).optional(),
  retailerId: z.string().min(1).max(200).optional(),
  entityId: z.string().min(1).max(200).optional(),
  durationMs: z.number().int().nonnegative().optional(),
  count: z.number().int().nonnegative().optional(),
  errorCode: z
    .string()
    .regex(/^[A-Z0-9_]{1,100}$/)
    .optional(),
})

export type OperationalEvent = z.input<typeof operationalEventSchema> &
  Record<string, unknown>

export function emitOperationalEvent(
  untrustedEvent: OperationalEvent,
  write: (event: Record<string, unknown>) => void = (event) =>
    console.log(JSON.stringify(event)),
): void {
  write(operationalEventSchema.parse(untrustedEvent))
}
