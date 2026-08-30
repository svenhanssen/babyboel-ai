import handler from '@tanstack/react-start/server-entry'

import { runScheduledAcquisition } from './scheduled'
import { handleAdminHealth } from './operations/http'
import { handlePublicHealth } from './operations/service'
import { createApplicationSecurityBoundary } from './security/admin-boundary'

const secureFetch = createApplicationSecurityBoundary(
  (request: Request, env: Env) => {
    const pathname = new URL(request.url).pathname
    if (pathname === '/health') return handlePublicHealth(env.DB)
    if (pathname === '/admin/health') {
      return handleAdminHealth(env.DB, {
        now: Date.now(),
        deploymentId: env.CF_VERSION_METADATA.id,
        observabilityUrl: env.CLOUDFLARE_OBSERVABILITY_URL,
      })
    }
    return handler.fetch(request)
  },
)

export default {
  fetch(request: Request, env: Env): Response | Promise<Response> {
    return secureFetch(request, env)
  },
  async scheduled(controller: ScheduledController, env: Env): Promise<void> {
    await runScheduledAcquisition(controller, env)
  },
} satisfies ExportedHandler<Env>
