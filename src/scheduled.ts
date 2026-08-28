import { parseEnvironment } from './environment'

export type ScheduledRun = {
  environment: 'local' | 'preview' | 'production'
  mode: 'disabled' | 'fixture' | 'live'
  cron: string
  scheduledTime: number
}

export async function runScheduledAcquisition(
  controller: ScheduledController,
  env: Pick<Env, 'APP_ENV' | 'ACQUISITION_MODE'>,
): Promise<ScheduledRun> {
  const environment = parseEnvironment(env)
  const run = {
    environment: environment.APP_ENV,
    mode: environment.ACQUISITION_MODE,
    cron: controller.cron,
    scheduledTime: controller.scheduledTime,
  } satisfies ScheduledRun

  console.log(
    JSON.stringify({
      event: 'scheduled_acquisition_placeholder',
      ...run,
    }),
  )

  return Promise.resolve(run)
}
