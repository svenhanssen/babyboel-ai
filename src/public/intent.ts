import { z } from 'zod'

import { isKnownPublicListing, isKnownPublicRetailerSlug } from './catalog'
import { outboundPlacementCodes } from './affiliate'

const intentSchema = z
  .object({
    retailer: z.string().min(1).max(40),
    listing: z.string().min(1).max(120),
    placement: z.enum(outboundPlacementCodes),
    affiliate: z.boolean(),
  })
  .strict()

const maximumIntentBodyBytes = 1024

const utcDay = (now: number) => new Date(now).toISOString().slice(0, 10)

const jsonHeaders = {
  'cache-control': 'no-store',
  'content-type': 'text/plain; charset=utf-8',
}

const readBoundedJson = async (request: Request) => {
  const declaredLength = Number(request.headers.get('content-length'))
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > maximumIntentBodyBytes
  ) {
    return undefined
  }
  const mediaType = request.headers
    .get('content-type')
    ?.split(';', 1)[0]
    ?.trim()
    .toLowerCase()
  if (mediaType !== 'application/json') return undefined
  const body = await request.arrayBuffer()
  if (body.byteLength > maximumIntentBodyBytes) return undefined
  try {
    return JSON.parse(new TextDecoder().decode(body)) as unknown
  } catch {
    return undefined
  }
}

export async function handleOutboundIntent(
  request: Request,
  database: Env['DB'],
  now = Date.now(),
): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { ...jsonHeaders, Allow: 'POST' },
    })
  }

  const origin = request.headers.get('origin')
  const requestOrigin = new URL(request.url).origin
  if (origin !== requestOrigin) {
    return new Response('Forbidden', { status: 403, headers: jsonHeaders })
  }

  const payload = await readBoundedJson(request)
  const parsed = intentSchema.safeParse(payload)
  if (
    !parsed.success ||
    !isKnownPublicRetailerSlug(parsed.data.retailer) ||
    !isKnownPublicListing(parsed.data.listing)
  ) {
    return new Response('Bad Request', { status: 400, headers: jsonHeaders })
  }

  await database
    .prepare(
      `INSERT INTO outbound_intent_counts (
         utc_day, retailer_slug, listing_key, placement_code, affiliate, count
       ) VALUES (?, ?, ?, ?, ?, 1)
       ON CONFLICT(utc_day, retailer_slug, listing_key, placement_code, affiliate)
       DO UPDATE SET count = count + 1`,
    )
    .bind(
      utcDay(now),
      parsed.data.retailer,
      parsed.data.listing,
      parsed.data.placement,
      parsed.data.affiliate ? 1 : 0,
    )
    .run()

  return new Response(null, {
    status: 204,
    headers: { 'cache-control': 'no-store' },
  })
}
