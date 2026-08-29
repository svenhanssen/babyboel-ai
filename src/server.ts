import handler from '@tanstack/react-start/server-entry'

import { runScheduledAcquisition } from './scheduled'
import { createApplicationSecurityBoundary } from './security/admin-boundary'

const secureFetch = createApplicationSecurityBoundary((request) =>
  handler.fetch(request),
)

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    return secureFetch(request, env)
  },
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    await runScheduledAcquisition(controller, env)
  },
} satisfies ExportedHandler<Env>
