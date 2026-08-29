import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWTVerifyGetKey,
} from 'jose'
import { beforeAll, describe, expect, it, vi } from 'vitest'

import {
  createApplicationSecurityBoundary,
  requireAdminContext,
  verifyAccessAssertion,
  type SecurityEnvironment,
} from '../src/security/admin-boundary'
import { requireVerifiedOutboundDestination } from '../src/security/outbound'

const issuer = 'https://babyboel.cloudflareaccess.com'
const productionEnvironment: SecurityEnvironment = {
  APP_ENV: 'production',
  ACCESS_TEAM_DOMAIN: 'babyboel.cloudflareaccess.com',
  ACCESS_AUD: 'babyboel-admin-audience',
  ACCESS_OPERATOR_SUBJECT: 'github|operator',
  TRUSTED_ORIGIN: 'https://babyboel.example',
}

describe('Cloudflare Access assertion verification', () => {
  let privateKey: CryptoKey
  let getKey: JWTVerifyGetKey

  beforeAll(async () => {
    const keyPair = await generateKeyPair('RS256', { extractable: true })
    privateKey = keyPair.privateKey
    getKey = createLocalJWKSet({
      keys: [
        {
          ...(await exportJWK(keyPair.publicKey)),
          kid: 'fixture-key',
          alg: 'RS256',
          use: 'sig',
        },
      ],
    })
  })

  const assertion = async (
    claims: {
      issuer?: string
      audience?: string
      subject?: string
      expiresAt?: number
      notBefore?: number
    } = {},
  ) => {
    const now = Math.floor(Date.now() / 1000)
    return new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'fixture-key' })
      .setIssuer(claims.issuer ?? issuer)
      .setAudience(claims.audience ?? productionEnvironment.ACCESS_AUD)
      .setSubject(
        claims.subject ?? productionEnvironment.ACCESS_OPERATOR_SUBJECT,
      )
      .setIssuedAt(now)
      .setNotBefore(claims.notBefore ?? now - 1)
      .setExpirationTime(claims.expiresAt ?? now + 300)
      .sign(privateKey)
  }

  it('accepts a signed assertion for the configured operator', async () => {
    await expect(
      verifyAccessAssertion(await assertion(), productionEnvironment, getKey),
    ).resolves.toEqual({ actorId: 'github|operator' })
  })

  it.each([
    ['expired', { expiresAt: 1 }],
    ['not active yet', { notBefore: Math.floor(Date.now() / 1000) + 300 }],
    ['wrong issuer', { issuer: 'https://attacker.example' }],
    ['wrong audience', { audience: 'another-application' }],
    ['unauthorized subject', { subject: 'github|someone-else' }],
  ])('rejects an assertion that is %s', async (_label, claims) => {
    await expect(
      verifyAccessAssertion(
        await assertion(claims),
        productionEnvironment,
        getKey,
      ),
    ).rejects.toThrow('ACCESS_DENIED')
  })

  it('rejects an assertion signed by an untrusted key', async () => {
    const untrusted = await generateKeyPair('RS256')
    const now = Math.floor(Date.now() / 1000)
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'untrusted-key' })
      .setIssuer(issuer)
      .setAudience(productionEnvironment.ACCESS_AUD)
      .setSubject(productionEnvironment.ACCESS_OPERATOR_SUBJECT)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(untrusted.privateKey)

    await expect(
      verifyAccessAssertion(token, productionEnvironment, getKey),
    ).rejects.toThrow('ACCESS_DENIED')
  })

  it('rejects an assertion whose lifetime exceeds the eight-hour session limit', async () => {
    const now = Math.floor(Date.now() / 1000)
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'fixture-key' })
      .setIssuer(issuer)
      .setAudience(productionEnvironment.ACCESS_AUD)
      .setSubject(productionEnvironment.ACCESS_OPERATOR_SUBJECT)
      .setIssuedAt(now)
      .setExpirationTime(now + 8 * 60 * 60 + 1)
      .sign(privateKey)

    await expect(
      verifyAccessAssertion(token, productionEnvironment, getKey),
    ).rejects.toThrow('ACCESS_DENIED')
  })

  it('rejects an assertion without a not-before claim', async () => {
    const now = Math.floor(Date.now() / 1000)
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'fixture-key' })
      .setIssuer(issuer)
      .setAudience(productionEnvironment.ACCESS_AUD)
      .setSubject(productionEnvironment.ACCESS_OPERATOR_SUBJECT)
      .setIssuedAt(now)
      .setExpirationTime(now + 300)
      .sign(privateKey)

    await expect(
      verifyAccessAssertion(token, productionEnvironment, getKey),
    ).rejects.toThrow('ACCESS_DENIED')
  })

  it('rejects an assertion issued in the future', async () => {
    const now = Math.floor(Date.now() / 1000)
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256', kid: 'fixture-key' })
      .setIssuer(issuer)
      .setAudience(productionEnvironment.ACCESS_AUD)
      .setSubject(productionEnvironment.ACCESS_OPERATOR_SUBJECT)
      .setIssuedAt(now + 300)
      .setNotBefore(now - 1)
      .setExpirationTime(now + 600)
      .sign(privateKey)

    await expect(
      verifyAccessAssertion(token, productionEnvironment, getKey),
    ).rejects.toThrow('ACCESS_DENIED')
  })

  it.each(['', 'not-a-jwt'])('rejects a malformed assertion', async (token) => {
    await expect(
      verifyAccessAssertion(token, productionEnvironment, getKey),
    ).rejects.toThrow('ACCESS_DENIED')
  })
})

describe('Admin request boundary', () => {
  const verifiedActor = { actorId: 'github|operator' }

  it('denies an Admin request before invoking its handler', async () => {
    const app = vi.fn(() => new Response('private'))
    const fetch = createApplicationSecurityBoundary(app, {
      verifyAssertion: vi.fn().mockRejectedValue(new Error('bad assertion')),
    })

    const response = await fetch(
      new Request('https://babyboel.example/admin'),
      productionEnvironment,
    )

    expect(response.status).toBe(401)
    expect(await response.text()).toBe('Unauthorized')
    expect(app).not.toHaveBeenCalled()
  })

  it('ignores spoofed identity and uses only the verified assertion', async () => {
    const fetch = createApplicationSecurityBoundary(
      (request) => {
        const context = requireAdminContext(request)
        return new Response(`${context.actorId}:${context.requestId}`)
      },
      {
        verifyAssertion: vi.fn().mockResolvedValue(verifiedActor),
        generateRequestId: () => 'request-123',
      },
    )

    const response = await fetch(
      new Request('https://babyboel.example/admin', {
        headers: {
          'Cf-Access-Jwt-Assertion': 'signed',
          'X-Babyboel-Actor': 'attacker',
        },
      }),
      productionEnvironment,
    )

    expect(await response.text()).toBe('github|operator:request-123')
  })

  it('allows explicit local authentication only in the local environment', async () => {
    const app = vi.fn(() => new Response('local admin'))
    const fetch = createApplicationSecurityBoundary(app)
    const localEnvironment: SecurityEnvironment = {
      ...productionEnvironment,
      APP_ENV: 'local',
      TRUSTED_ORIGIN: 'http://localhost:3000',
    }

    const localResponse = await fetch(
      new Request('http://localhost:3000/admin', {
        headers: { 'X-Babyboel-Local-Actor': 'local-operator' },
      }),
      localEnvironment,
    )
    const productionResponse = await fetch(
      new Request('https://babyboel.example/admin', {
        headers: { 'X-Babyboel-Local-Actor': 'local-operator' },
      }),
      productionEnvironment,
    )

    expect(localResponse.status).toBe(200)
    expect(productionResponse.status).toBe(401)
    expect(app).toHaveBeenCalledTimes(1)
  })

  it('requires matching Origin and double-submit token for Admin mutations', async () => {
    const app = vi.fn(() => new Response('changed'))
    const fetch = createApplicationSecurityBoundary(app, {
      verifyAssertion: vi.fn().mockResolvedValue(verifiedActor),
    })
    const authHeaders = { 'Cf-Access-Jwt-Assertion': 'signed' }

    const initial = await fetch(
      new Request('https://babyboel.example/admin', { headers: authHeaders }),
      productionEnvironment,
    )
    const setCookie = initial.headers.get('set-cookie')
    const token = setCookie?.match(/__Host-babyboel-csrf=([^;]+)/)?.[1]
    expect(token).toBeTruthy()

    const crossOrigin = await fetch(
      new Request('https://babyboel.example/admin/change', {
        method: 'POST',
        headers: {
          ...authHeaders,
          cookie: `__Host-babyboel-csrf=${token}`,
          origin: 'https://attacker.example',
          'x-babyboel-csrf': token!,
        },
      }),
      productionEnvironment,
    )
    const missingToken = await fetch(
      new Request('https://babyboel.example/admin/change', {
        method: 'POST',
        headers: {
          ...authHeaders,
          origin: productionEnvironment.TRUSTED_ORIGIN,
        },
      }),
      productionEnvironment,
    )
    const accepted = await fetch(
      new Request('https://babyboel.example/admin/change', {
        method: 'POST',
        headers: {
          ...authHeaders,
          cookie: `__Host-babyboel-csrf=${token}`,
          origin: productionEnvironment.TRUSTED_ORIGIN,
          'x-babyboel-csrf': token!,
        },
      }),
      productionEnvironment,
    )

    expect(crossOrigin.status).toBe(403)
    expect(missingToken.status).toBe(403)
    expect(accepted.status).toBe(200)
    expect(app).toHaveBeenCalledTimes(2)
  })

  it('rejects non-POST Admin mutation methods', async () => {
    const app = vi.fn(() => new Response('changed'))
    const fetch = createApplicationSecurityBoundary(app, {
      verifyAssertion: vi.fn().mockResolvedValue(verifiedActor),
    })

    const response = await fetch(
      new Request('https://babyboel.example/admin/change', {
        method: 'DELETE',
        headers: { 'Cf-Access-Jwt-Assertion': 'signed' },
      }),
      productionEnvironment,
    )

    expect(response.status).toBe(405)
    expect(app).not.toHaveBeenCalled()
  })

  it('rejects oversized Admin mutation input before invoking its handler', async () => {
    const app = vi.fn(() => new Response('changed'))
    const fetch = createApplicationSecurityBoundary(app, {
      verifyAssertion: vi.fn().mockResolvedValue(verifiedActor),
    })
    const token = 'bounded-fixture-token'

    const response = await fetch(
      new Request('https://babyboel.example/admin/change', {
        method: 'POST',
        headers: {
          'Cf-Access-Jwt-Assertion': 'signed',
          'content-type': 'application/x-www-form-urlencoded',
          cookie: `__Host-babyboel-csrf=${token}`,
          origin: productionEnvironment.TRUSTED_ORIGIN,
          'x-babyboel-csrf': token,
        },
        body: `value=${'x'.repeat(33_000)}`,
      }),
      productionEnvironment,
    )

    expect(response.status).toBe(413)
    expect(app).not.toHaveBeenCalled()
  })

  it('adds security headers without making public pages depend on Admin auth', async () => {
    const app = vi.fn(() => new Response('public catalog'))
    const fetch = createApplicationSecurityBoundary(app)

    const response = await fetch(
      new Request('https://babyboel.example/products'),
      productionEnvironment,
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-security-policy')).toContain(
      "frame-ancestors 'none'",
    )
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('strict-transport-security')).toContain(
      'max-age=',
    )
    expect(app).toHaveBeenCalledOnce()
  })

  it('redacts unexpected failures and keeps Admin responses private', async () => {
    const fetch = createApplicationSecurityBoundary(
      () => {
        throw new Error('secret database detail')
      },
      {
        verifyAssertion: vi.fn().mockResolvedValue(verifiedActor),
        log: vi.fn(),
      },
    )

    const response = await fetch(
      new Request('https://babyboel.example/admin', {
        headers: { 'Cf-Access-Jwt-Assertion': 'signed' },
      }),
      productionEnvironment,
    )

    expect(response.status).toBe(500)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(await response.text()).toBe('Internal Server Error')
  })

  it('does not allow a handler called outside the boundary to invent context', () => {
    expect(() =>
      requireAdminContext(new Request('https://babyboel.example/admin')),
    ).toThrow('ADMIN_CONTEXT_REQUIRED')
  })
})

describe('Outbound destinations', () => {
  const verified = 'https://retailer.example/listing/SKU-123?variant=80-count'

  it('returns the exact verified Listing destination', () => {
    expect(requireVerifiedOutboundDestination(verified, verified)).toBe(
      verified,
    )
  })

  it.each([
    'https://attacker.example/',
    'https://retailer.example/listing/SKU-999',
    '//attacker.example/',
    'javascript:alert(1)',
  ])('rejects an open-redirect destination payload: %s', (requested) => {
    expect(() =>
      requireVerifiedOutboundDestination(requested, verified),
    ).toThrow('OUTBOUND_DESTINATION_REJECTED')
  })
})
