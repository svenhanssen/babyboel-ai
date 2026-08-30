import { parseEnvironment } from './environment'
import { emitOperationalEvent } from './operations/events'
import { runOperationalMaintenance } from './operations/service'

export type ScheduledRun = {
  environment: 'local' | 'preview' | 'production'
  mode: 'disabled' | 'fixture' | 'live'
  cron: string
  scheduledTime: number
}

export async function runScheduledAcquisition(
  controller: ScheduledController,
  env: Pick<
    Env,
    | 'APP_ENV'
    | 'ACQUISITION_MODE'
    | 'DB'
    | 'EVIDENCE'
    | 'OPS_EMAIL'
    | 'OPERATOR_EMAIL'
    | 'ALERT_FROM_EMAIL'
  >,
): Promise<ScheduledRun> {
  const environment = parseEnvironment(env)
  const run = {
    environment: environment.APP_ENV,
    mode: environment.ACQUISITION_MODE,
    cron: controller.cron,
    scheduledTime: controller.scheduledTime,
  } satisfies ScheduledRun

  try {
    await runOperationalMaintenance(
      {
        APP_ENV: environment.APP_ENV,
        DB: env.DB,
        EVIDENCE: env.EVIDENCE,
        OPERATOR_EMAIL: env.OPERATOR_EMAIL,
        ALERT_FROM_EMAIL: env.ALERT_FROM_EMAIL,
        sendEmail: (message) => env.OPS_EMAIL.send(message),
      },
      Date.now(),
    )
  } catch (error) {
    emitOperationalEvent({
      event: 'operational_error',
      outcome: 'failure',
      environment: run.environment,
      errorCode: 'OPERATIONAL_MAINTENANCE_FAILED',
    })
    throw error
  }
  return Promise.resolve(run)
}
