import { describe, expect, it, vi } from 'vitest'

import { fetchAuthorizedSource } from '../src/retailers/fetch'

const source = {
  url: 'https://synthetic.babyboel.test/feed.json',
  allowedHosts: ['synthetic.babyboel.test'],
  timeoutMs: 50,
  maxBytes: 1_024,
  allowedContentTypes: ['application/json'],
  maxRetries: 2,
}

const jsonResponse = (body: string, init?: ResponseInit) =>
  new Response(body, {
    status: 200,
    headers: { 'content-type': 'application/json' },
    ...init,
  })

const idle = () => Promise.resolve()

describe('authorized source fetch', () => {
  it('retries a transient failure and returns a hashed JSON body', async () => {
    const sleep = vi.fn(idle)
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValueOnce(new Response('unavailable', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse('{"items":[]}'))

    const result = await fetchAuthorizedSource({
      ...source,
      fetch,
      sleep,
    })

    expect(result.status).toBe(200)
    expect(result.bodyText).toBe('{"items":[]}')
    expect(result.integrityHash).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(sleep).toHaveBeenCalledTimes(1)
  })

  it('does not retry an authorization challenge', async () => {
    const fetch = vi
      .fn<typeof globalThis.fetch>()
      .mockResolvedValue(new Response('login', { status: 401 }))

    await expect(
      fetchAuthorizedSource({ ...source, fetch, sleep: idle }),
    ).rejects.toMatchObject({ code: 'SOURCE_UNAUTHORIZED' })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('rejects a redirect that leaves the allowlist', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://evil.example/feed.json' },
      }),
    )

    await expect(
      fetchAuthorizedSource({ ...source, fetch, sleep: idle }),
    ).rejects.toMatchObject({ code: 'SOURCE_REDIRECT_REJECTED' })
  })

  it('rejects oversized and unexpected content without leaking bodies', async () => {
    const oversized = await fetchAuthorizedSource({
      ...source,
      fetch: () =>
        Promise.resolve(
          jsonResponse('x'.repeat(2_048), {
            headers: {
              'content-type': 'application/json',
              'content-length': '2048',
            },
          }),
        ),
      sleep: idle,
    }).catch((error: unknown) => error)

    const unexpected = await fetchAuthorizedSource({
      ...source,
      fetch: () =>
        Promise.resolve(
          new Response('<html>captcha token=super-secret</html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
        ),
      sleep: idle,
    }).catch((error: unknown) => error)

    expect(oversized).toMatchObject({ code: 'SOURCE_BYTE_CAP_EXCEEDED' })
    expect(unexpected).toMatchObject({ code: 'SOURCE_CONTENT_TYPE_REJECTED' })
    expect(JSON.stringify(oversized)).not.toContain('xxxxx')
    expect(JSON.stringify(unexpected)).not.toContain('super-secret')
  })

  it('times out a hung source without retrying as a challenge', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(
      (_input, init) =>
        new Promise((_, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(Object.assign(new Error('Aborted'), { name: 'AbortError' }))
          })
        }),
    )

    await expect(
      fetchAuthorizedSource({
        ...source,
        timeoutMs: 5,
        fetch,
        sleep: idle,
      }),
    ).rejects.toMatchObject({ code: 'SOURCE_TIMEOUT' })
  })
})
