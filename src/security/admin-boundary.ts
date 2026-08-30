import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose'

export type SecurityEnvironment = {
  APP_ENV: 'local' | 'preview' | 'production'
  ACCESS_TEAM_DOMAIN: string
  ACCESS_AUD: string
  ACCESS_OPERATOR_SUBJECT: string
  TRUSTED_ORIGIN: string
}

const adminContextBrand: unique symbol = Symbol('AdminContext')

export type AdminContext = {
  readonly actorId: string
  readonly requestId: string
  readonly [adminContextBrand]: true
}

type ApplicationHandler<Environment extends SecurityEnvironment> = (
  request: Request,
  environment: Environment,
) => Response | Promise<Response>

type SecurityDependencies = {
  verifyAssertion?: (
    assertion: string,
    environment: SecurityEnvironment,
  ) => Promise<{ actorId: string }>
  generateRequestId?: () => string
  generateCsrfToken?: () => string
  log?: (event: Record<string, unknown>) => void
}

const adminContexts = new WeakMap<Request, AdminContext>()
const remoteKeySets = new Map<string, JWTVerifyGetKey>()

class AccessDeniedError extends Error {
  constructor() {
    super('ACCESS_DENIED')
  }
}

const accessIssuer = (environment: SecurityEnvironment) =>
  `https://${environment.ACCESS_TEAM_DOMAIN}`

const remoteKeysFor = (environment: SecurityEnvironment) => {
  const issuer = accessIssuer(environment)
  const existing = remoteKeySets.get(issuer)
  if (existing) return existing

  const keys = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`))
  remoteKeySets.set(issuer, keys)
  return keys
}

export async function verifyAccessAssertion(
  assertion: string,
  environment: SecurityEnvironment,
  getKey: JWTVerifyGetKey = remoteKeysFor(environment),
): Promise<{ actorId: string }> {
  try {
    const result = await jwtVerify(assertion, getKey, {
      algorithms: ['RS256'],
      audience: environment.ACCESS_AUD,
      issuer: accessIssuer(environment),
    })
    const now = Math.floor(Date.now() / 1_000)

    if (
      typeof result.payload.sub !== 'string' ||
      result.payload.sub !== environment.ACCESS_OPERATOR_SUBJECT ||
      typeof result.payload.iat !== 'number' ||
      typeof result.payload.nbf !== 'number' ||
      typeof result.payload.exp !== 'number' ||
      result.payload.iat > now + 60 ||
      result.payload.exp <= result.payload.iat ||
      result.payload.exp - result.payload.iat > 8 * 60 * 60
    ) {
      throw new AccessDeniedError()
    }

    return { actorId: result.payload.sub }
  } catch {
    throw new AccessDeniedError()
  }
}

export function requireAdminContext(request: Request): AdminContext {
  const context = adminContexts.get(request)
  if (!context) throw new Error('ADMIN_CONTEXT_REQUIRED')
  return context
}

export function assertTrustedAdminContext(context: AdminContext): void {
  if (context[adminContextBrand] !== true) {
    throw new Error('ADMIN_CONTEXT_REQUIRED')
  }
}

export async function authenticateAdminServerRequest(
  request: Request,
  environment: SecurityEnvironment,
): Promise<AdminContext> {
  const existing = adminContexts.get(request)
  if (existing) return existing

  let actorId: string
  if (environment.APP_ENV === 'local') {
    if (request.headers.get('X-Babyboel-Local-Actor') !== 'local-operator') {
      throw new Error('ACCESS_DENIED')
    }
    actorId = 'local-operator'
  } else {
    const assertion = request.headers.get('Cf-Access-Jwt-Assertion')
    if (!assertion) throw new Error('ACCESS_DENIED')
    actorId = (await verifyAccessAssertion(assertion, environment)).actorId
  }

  if (request.method === 'POST') {
    const declaredLength = Number(request.headers.get('content-length'))
    if (
      Number.isFinite(declaredLength) &&
      declaredLength > maximumAdminBodyBytes
    ) {
      throw new Error('PAYLOAD_TOO_LARGE')
    }
    const mediaType = request.headers
      .get('content-type')
      ?.split(';', 1)[0]
      ?.trim()
      .toLowerCase()
    if (
      mediaType !== 'application/json' &&
      mediaType !== 'application/x-www-form-urlencoded'
    ) {
      throw new Error('UNSUPPORTED_MEDIA_TYPE')
    }
    const cookieName = csrfCookieName(environment)
    if (
      request.headers.get('origin') !== environment.TRUSTED_ORIGIN ||
      !tokensMatch(
        readCookie(request, cookieName),
        request.headers.get('x-babyboel-csrf') ?? undefined,
      )
    ) {
      throw new Error('CSRF_DENIED')
    }
  }

  const context: AdminContext = {
    actorId,
    requestId: request.headers.get('x-request-id') ?? crypto.randomUUID(),
    [adminContextBrand]: true,
  }
  adminContexts.set(request, context)
  return context
}

const isAdminPath = (pathname: string) =>
  pathname === '/admin' || pathname.startsWith('/admin/')

const csrfCookieName = (environment: SecurityEnvironment) =>
  environment.APP_ENV === 'local' ? 'babyboel-csrf' : '__Host-babyboel-csrf'

const readCookie = (request: Request, name: string) => {
  const cookie = request.headers.get('cookie')
  if (!cookie || cookie.length > 4_096) return undefined

  for (const item of cookie.split(';')) {
    const separator = item.indexOf('=')
    if (separator === -1) continue
    if (item.slice(0, separator).trim() === name) {
      return item.slice(separator + 1).trim()
    }
  }

  return undefined
}

const tokensMatch = (left: string | undefined, right: string | undefined) => {
  if (!left || !right || left.length !== right.length || left.length > 128) {
    return false
  }

  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

const randomToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return btoa(String.fromCharCode(...bytes))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replaceAll('=', '')
}

const maximumAdminBodyBytes = 32 * 1_024

const readBoundedBody = async (request: Request) => {
  const declaredLength = Number(request.headers.get('content-length'))
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > maximumAdminBodyBytes
  ) {
    return undefined
  }
  if (!request.body) return new Uint8Array()

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0

  while (true) {
    const result = await reader.read()
    if (result.done) break
    length += result.value.byteLength
    if (length > maximumAdminBodyBytes) {
      await reader.cancel()
      return undefined
    }
    chunks.push(result.value)
  }

  const body = new Uint8Array(length)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

const csrfCookie = (
  name: string,
  token: string,
  environment: SecurityEnvironment,
) =>
  `${name}=${token}; Path=/; SameSite=Strict${
    environment.APP_ENV === 'local' ? '' : '; Secure'
  }`

const responseWithSecurityHeaders = (
  response: Response,
  environment: SecurityEnvironment,
  admin: boolean,
) => {
  const secured = new Response(response.body, response)
  secured.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; base-uri 'self'; connect-src 'self'; font-src 'self'; form-action 'self'; frame-ancestors 'none'; img-src 'self' data:; object-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  )
  secured.headers.set('Cross-Origin-Opener-Policy', 'same-origin')
  secured.headers.set(
    'Permissions-Policy',
    'camera=(), geolocation=(), microphone=()',
  )
  secured.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  secured.headers.set('X-Content-Type-Options', 'nosniff')
  secured.headers.set('X-Frame-Options', 'DENY')

  if (environment.APP_ENV !== 'local') {
    secured.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    )
  }
  if (admin) secured.headers.set('Cache-Control', 'private, no-store')

  return secured
}

const safeResponse = (
  status: number,
  body: string,
  environment: SecurityEnvironment,
  admin: boolean,
  extraHeaders?: HeadersInit,
) =>
  responseWithSecurityHeaders(
    new Response(body, { status, headers: extraHeaders }),
    environment,
    admin,
  )

export function createApplicationSecurityBoundary<
  Environment extends SecurityEnvironment,
>(
  application: ApplicationHandler<Environment>,
  dependencies: SecurityDependencies = {},
) {
  const verifyAssertion =
    dependencies.verifyAssertion ??
    ((assertion: string, environment: SecurityEnvironment) =>
      verifyAccessAssertion(assertion, environment))
  const generateRequestId =
    dependencies.generateRequestId ?? (() => crypto.randomUUID())
  const generateCsrfToken = dependencies.generateCsrfToken ?? randomToken
  const log = dependencies.log ?? ((event) => console.log(event))

  return async (request: Request, environment: Environment) => {
    const pathname = new URL(request.url).pathname
    const admin = isAdminPath(pathname)
    const requestId = generateRequestId()

    try {
      if (!admin) {
        return responseWithSecurityHeaders(
          await application(request, environment),
          environment,
          false,
        )
      }

      let actorId: string
      if (environment.APP_ENV === 'local') {
        if (
          request.headers.get('X-Babyboel-Local-Actor') !== 'local-operator'
        ) {
          log({ event: 'admin_auth_denied', requestId })
          return safeResponse(401, 'Unauthorized', environment, true)
        }
        actorId = 'local-operator'
      } else {
        const assertion = request.headers.get('Cf-Access-Jwt-Assertion')
        if (!assertion) {
          log({ event: 'admin_auth_denied', requestId })
          return safeResponse(401, 'Unauthorized', environment, true)
        }

        try {
          actorId = (await verifyAssertion(assertion, environment)).actorId
        } catch {
          log({ event: 'admin_auth_denied', requestId })
          return safeResponse(401, 'Unauthorized', environment, true)
        }
      }

      if (!['GET', 'HEAD', 'POST'].includes(request.method)) {
        return safeResponse(405, 'Method Not Allowed', environment, true, {
          Allow: 'GET, HEAD, POST',
        })
      }

      const cookieName = csrfCookieName(environment)
      let applicationRequest = request
      if (request.method === 'POST') {
        if (
          request.headers.get('origin') !== environment.TRUSTED_ORIGIN ||
          !tokensMatch(
            readCookie(request, cookieName),
            request.headers.get('x-babyboel-csrf') ?? undefined,
          )
        ) {
          log({ event: 'admin_csrf_denied', requestId })
          return safeResponse(403, 'Forbidden', environment, true)
        }

        const contentType = request.headers.get('content-type')
        const mediaType = contentType?.split(';', 1)[0]?.trim().toLowerCase()
        if (
          request.body &&
          mediaType !== 'application/json' &&
          mediaType !== 'application/x-www-form-urlencoded'
        ) {
          return safeResponse(415, 'Unsupported Media Type', environment, true)
        }

        const body = await readBoundedBody(request)
        if (!body) {
          return safeResponse(413, 'Payload Too Large', environment, true)
        }
        applicationRequest = new Request(request, { body })
      }

      adminContexts.set(applicationRequest, {
        actorId,
        requestId,
        [adminContextBrand]: true,
      })
      const response = responseWithSecurityHeaders(
        await application(applicationRequest, environment),
        environment,
        true,
      )

      if (
        (request.method === 'GET' || request.method === 'HEAD') &&
        !readCookie(request, cookieName)
      ) {
        response.headers.append(
          'Set-Cookie',
          csrfCookie(cookieName, generateCsrfToken(), environment),
        )
      }

      return response
    } catch {
      log({
        event: 'operational_error',
        outcome: 'failure',
        environment: environment.APP_ENV,
        requestId,
        errorCode: admin ? 'ADMIN_REQUEST_FAILED' : 'PUBLIC_REQUEST_FAILED',
      })
      return safeResponse(500, 'Internal Server Error', environment, admin)
    }
  }
}
