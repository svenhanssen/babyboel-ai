import handler from '@tanstack/react-start/server-entry'

import { runScheduledAcquisition } from './scheduled'

export default {
  fetch(request: Request): Response | Promise<Response> {
    return handler.fetch(request)
  },
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    await runScheduledAcquisition(controller, env)
  },
} satisfies ExportedHandler<Env>
