export class SourceFetchError extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'SourceFetchError'
    this.code = code
  }
}

const transientStatuses = new Set([408, 429, 500, 502, 503, 504])
const redirectStatuses = new Set([301, 302, 303, 307, 308])

export type AuthorizedSourceRequest = {
  url: string
  allowedHosts: readonly string[]
  timeoutMs: number
  maxBytes: number
  allowedContentTypes: readonly string[]
  maxRetries: number
  fetch: typeof globalThis.fetch
  sleep: (milliseconds: number) => Promise<void>
}

export type FetchedSource = {
  url: string
  status: number
  contentType: string
  bodyText: string
  integrityHash: string
}

const hostnameOf = (value: string) => {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new SourceFetchError('SOURCE_URL_REJECTED')
  }
  return url.hostname
}

const assertAllowedHost = (value: string, allowedHosts: readonly string[]) => {
  const hostname = hostnameOf(value)
  if (!allowedHosts.includes(hostname)) {
    throw new SourceFetchError('SOURCE_HOST_REJECTED')
  }
  return hostname
}

const contentTypeAllowed = (
  contentType: string,
  allowedContentTypes: readonly string[],
) =>
  allowedContentTypes.some((allowed) =>
    contentType.toLowerCase().startsWith(allowed.toLowerCase()),
  )

const digestSha256 = async (body: string) => {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(body),
  )
  return `sha256:${[...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')}`
}

const retryDelayMs = (response: Response | null, attempt: number) => {
  const retryAfter = response?.headers.get('retry-after')
  const parsed =
    retryAfter === null || retryAfter === undefined ? NaN : Number(retryAfter)
  if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 5) {
    return Math.round(parsed * 1_000)
  }
  return Math.min(250 * 2 ** attempt, 1_000)
}

const readLimitedBody = async (response: Response, maxBytes: number) => {
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new SourceFetchError('SOURCE_BYTE_CAP_EXCEEDED')
  }
  const buffer = new Uint8Array(await response.arrayBuffer())
  if (buffer.byteLength > maxBytes) {
    throw new SourceFetchError('SOURCE_BYTE_CAP_EXCEEDED')
  }
  return new TextDecoder().decode(buffer)
}

const fetchOnce = async (
  request: AuthorizedSourceRequest,
  url: string,
  redirectCount: number,
): Promise<Response> => {
  assertAllowedHost(url, request.allowedHosts)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), request.timeoutMs)
  try {
    const response = await request.fetch(url, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { accept: request.allowedContentTypes.join(', ') },
    })
    if (redirectStatuses.has(response.status)) {
      if (redirectCount >= 3) {
        throw new SourceFetchError('SOURCE_REDIRECT_REJECTED')
      }
      const location = response.headers.get('location')
      if (!location) throw new SourceFetchError('SOURCE_REDIRECT_REJECTED')
      const next = new URL(location, url)
      if (!request.allowedHosts.includes(next.hostname)) {
        throw new SourceFetchError('SOURCE_REDIRECT_REJECTED')
      }
      return fetchOnce(request, next.href, redirectCount + 1)
    }
    return response
  } catch (error) {
    if (error instanceof SourceFetchError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new SourceFetchError('SOURCE_TIMEOUT')
    }
    throw new SourceFetchError('SOURCE_NETWORK_FAILURE')
  } finally {
    clearTimeout(timeout)
  }
}

export async function fetchAuthorizedSource(
  request: AuthorizedSourceRequest,
): Promise<FetchedSource> {
  assertAllowedHost(request.url, request.allowedHosts)
  let attempt = 0
  let lastTransient: Response | null = null
  while (attempt <= request.maxRetries) {
    try {
      const response = await fetchOnce(request, request.url, 0)
      if (transientStatuses.has(response.status)) {
        lastTransient = response
        if (attempt === request.maxRetries) {
          throw new SourceFetchError('SOURCE_TRANSIENT_FAILURE')
        }
        await request.sleep(retryDelayMs(response, attempt))
        attempt += 1
        continue
      }
      if (response.status === 401 || response.status === 403) {
        throw new SourceFetchError('SOURCE_UNAUTHORIZED')
      }
      if (response.status < 200 || response.status >= 300) {
        throw new SourceFetchError('SOURCE_HTTP_REJECTED')
      }
      const contentType = response.headers.get('content-type') ?? ''
      if (!contentTypeAllowed(contentType, request.allowedContentTypes)) {
        throw new SourceFetchError('SOURCE_CONTENT_TYPE_REJECTED')
      }
      const bodyText = await readLimitedBody(response, request.maxBytes)
      return {
        url: request.url,
        status: response.status,
        contentType,
        bodyText,
        integrityHash: await digestSha256(bodyText),
      }
    } catch (error) {
      if (
        error instanceof SourceFetchError &&
        (error.code === 'SOURCE_NETWORK_FAILURE' ||
          error.code === 'SOURCE_TIMEOUT') &&
        attempt < request.maxRetries
      ) {
        await request.sleep(retryDelayMs(lastTransient, attempt))
        attempt += 1
        continue
      }
      throw error
    }
  }
  throw new SourceFetchError('SOURCE_TRANSIENT_FAILURE')
}
