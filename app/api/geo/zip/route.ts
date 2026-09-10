import { NextRequest, NextResponse } from 'next/server'
import { getPayloadInstance } from '@/lib/payload-server'
import { lookupZip } from '@/lib/zip-lookup'
import { RateLimiter, enforceLimit } from '@/lib/rate-limit'

/**
 * ZIP centroid lookup for the manual "near me" override (2026-09-10).
 *
 * The automatic near-me listing on /brands/<brand>, /services/<service> and
 * /clinics resolves the visitor's ZIP from their IP. This endpoint is the other
 * half: a visitor whose IP gave nothing, or gave the wrong place, types five
 * digits and gets the coordinates the listing needs.
 *
 * Reads the local zip_codes table (41,488 GeoNames centroids) through the app's
 * own pool. No outbound call, no rate ceiling from a third party.
 */

// Public and unauthenticated, and it touches the 4-connection pool.
const limiter = new RateLimiter(60, 60 * 1000)

/**
 * ZIP centroids are fixed geography. A day at the edge and a week of
 * stale-while-revalidate costs nothing in correctness and takes the repeat
 * lookups (one per visitor who sets a ZIP) off the database entirely.
 */
const CACHE_CONTROL = 'public, s-maxage=86400, stale-while-revalidate=604800'

export async function GET(req: NextRequest) {
  const blocked = await enforceLimit(req, limiter, 'geo-zip')
  if (blocked) return blocked

  const zip = (req.nextUrl.searchParams.get('zip') ?? '').trim()

  // lookupZip validates the same shape, but a malformed value must not reach
  // the pool at all: this route is the boundary and it is where junk stops.
  if (!/^\d{5}$/.test(zip)) {
    return NextResponse.json({ found: false }, { headers: { 'Cache-Control': CACHE_CONTROL } })
  }

  const payload = await getPayloadInstance()
  const pool = (payload.db as any).pool
  const hit = await lookupZip(zip, pool)

  // Always 200. "That ZIP is not in the dataset" is a normal answer the UI
  // shows as an inline message, not an error the console should shout about.
  if (!hit) {
    return NextResponse.json({ found: false }, { headers: { 'Cache-Control': CACHE_CONTROL } })
  }

  return NextResponse.json(
    {
      found: true,
      zip: hit.zip,
      city: hit.city,
      state: hit.state,
      lat: hit.lat,
      lng: hit.lng,
    },
    { headers: { 'Cache-Control': CACHE_CONTROL } },
  )
}
