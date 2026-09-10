import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { requireAdmin } from '@/lib/auth-guards'
import { getIp } from '@/lib/rate-limit'
import { lookupGeo } from '@/lib/geo-ip'

export const dynamic = 'force-dynamic'

/**
 * Client-IP resolution diagnostic (admin only).
 *
 * Every rate limit in the app is keyed on getIp(). The correct way to read
 * X-Forwarded-For depends on how many proxy hops sit in front of this process,
 * which is deployment-specific and changed when the project moved from Railway
 * to DigitalOcean. Rather than assume, hit this route from a known external IP
 * and compare:
 *
 *   1. Look up your real public IP (e.g. `curl ifconfig.me`).
 *   2. GET /api/admin/debug/ip while logged in as an admin.
 *   3. Check `resolved` matches your real IP.
 *
 * If it does not, `forwardedForEntries` shows the parsed list with an index per
 * entry. Find the index holding your real IP and set:
 *
 *   TRUSTED_PROXY_COUNT = forwardedForEntries.length - thatIndex
 *
 * Once Cloudflare is in front of the origin, set TRUST_CF_HEADERS=true instead;
 * `cfConnectingIp` below will then be used directly and no hop counting is
 * needed. Only enable that after confirming the origin cannot be reached
 * directly, bypassing Cloudflare.
 *
 * Returns no persistent data and writes nothing. Safe to leave deployed, but
 * it is admin-gated because request headers can carry infrastructure detail.
 */
export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)
  const guard = requireAdmin(user)
  if (guard) return guard

  const xff = req.headers.get('x-forwarded-for')
  const entries = xff
    ? xff.split(',').map((s, i) => ({ index: i, value: s.trim() }))
    : []

  const trustCount = Math.max(1, parseInt(process.env.TRUSTED_PROXY_COUNT || '1', 10))

  /**
   * Every `cf-*` header, collected by iterating the request rather than by
   * listing names we think Cloudflare uses. The visitor-location Managed
   * Transform ("Add visitor location headers") is a dashboard toggle, and the
   * exact names it adds are what this route exists to report -- guessing them
   * from memory is how a geo path ships reading a header that never arrives.
   *
   * Header values are not secrets, but this route is admin-gated anyway because
   * the full set describes the edge configuration.
   */
  const cloudflareHeaders: Record<string, string> = {}
  req.headers.forEach((value, name) => {
    if (name.toLowerCase().startsWith('cf-')) cloudflareHeaders[name.toLowerCase()] = value
  })

  // The current geo source, side by side with the headers above, so the two can
  // be compared against a known real ZIP in one look.
  const ipApi = await lookupGeo(getIp(req))

  return NextResponse.json(
    {
      resolved: getIp(req),
      cloudflareHeaders,
      ipApi,
      config: {
        TRUSTED_PROXY_COUNT: trustCount,
        TRUST_CF_HEADERS: process.env.TRUST_CF_HEADERS === 'true',
        // Which index of forwardedForEntries the current config will read.
        selectedIndex: Math.max(0, entries.length - trustCount),
      },
      headers: {
        cfConnectingIp: req.headers.get('cf-connecting-ip'),
        xForwardedFor: xff,
        xRealIp: req.headers.get('x-real-ip'),
        trueClientIp: req.headers.get('true-client-ip'),
      },
      forwardedForEntries: entries,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
