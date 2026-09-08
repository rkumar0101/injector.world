import { getPayloadInstance } from './payload-server'

// ── Route types ───────────────────────────────────────────────────────────────
// Services path (SEO — indexed). Everything lives under /services/*.
//   /services                                   → services-index (all services)
//   /services/[svc]                             → service-pillar
//   /services/[svc]/[state]                     → service-state
//   /services/[svc]/[state]/[city]              → service-city-directory (money page)
//
// The Find path (`/[state]`, `/[state]/[city]`) is GONE as of 2026-09-09. State
// and city hubs live under `/clinics/[state]` and `/clinics/[state]/[city]`, as
// real pages with their own route files, so the catch-all never sees them. A
// bare `/alabama` now falls through to not-found on purpose. There is no
// redirect layer: the site is sitewide noindex, so there was no link equity to
// preserve. Do not re-add those branches here.
//
// Neighborhoods are NOT routable pages. They surface as a filter on the city
// pages (driven by clinic data). Any neighborhood URL 404s.
//
// Old top-level treatment URLs (/botox, /botox/texas, /botox/texas/houston)
// resolve to not-found — they 404 cleanly. No redirects.

export type ResolvedRoute =
  | { type: 'services-index' }
  | { type: 'service-pillar'; serviceSlug: string }
  | { type: 'service-state'; serviceSlug: string; stateSlug: string }
  | { type: 'service-city-directory'; serviceSlug: string; stateSlug: string; citySlug: string }
  | { type: 'brands-index' }
  | { type: 'brand-pillar'; brandSlug: string }
  | { type: 'brand-state'; brandSlug: string; stateSlug: string }
  | { type: 'brand-city-directory'; brandSlug: string; stateSlug: string; citySlug: string }
  | { type: 'not-found' }

type LocationEntry = {
  id: string
  kind: string
  name: string
  stateCode: string
  parentSlug?: string
}

// Module-level caches with 60 s TTL so new services/brands/locations become
// routable without a server restart.
const CACHE_TTL_MS = 60_000
let serviceSet: Set<string> | null = null
let brandSet: Set<string> | null = null
let locationMap: Map<string, LocationEntry> | null = null
let cachedAt = 0

async function ensureCaches() {
  const stale = Date.now() - cachedAt > CACHE_TTL_MS
  if (serviceSet && brandSet && locationMap && !stale) return

  const payload = await getPayloadInstance()

  const [svcRes, brandRes] = await Promise.all([
    payload.find({ collection: 'services', limit: 500, depth: 0 }),
    payload.find({ collection: 'brands', limit: 500, depth: 0 }),
  ])
  serviceSet = new Set(svcRes.docs.map((t: any) => t.slug as string))
  brandSet = new Set(brandRes.docs.map((b: any) => b.slug as string))

  /**
   * Raw SQL, and deliberately unbounded.
   *
   * This was `payload.find({ collection: 'locations', limit: 5000 })`. On
   * 2026-09-03 the directory rebuild took locations from 4,278 to 6,098, and
   * everything past the 5,000th row silently vanished from this map -- which is
   * the only thing that decides whether a url routes at all. Payload's default
   * order is newest-first, so the rows that fell off were the OLDEST ones: every
   * top-20 metro and, worse, the state rows themselves. `/texas` (row 6,056),
   * `/texas/houston-tx`, and every `/services/<svc>/texas/...` under them
   * returned 404 in production while the data sat there intact.
   *
   * A bigger number would only move the cliff, so there is no limit now. Five
   * columns over ~6k rows is a few hundred KB; payload.find would also have
   * joined every relationship field on the collection regardless of depth.
   */
  const pool = (payload.db as any).pool
  const locRes = await pool.query(
    `SELECT id, slug, kind, name, state FROM locations WHERE slug IS NOT NULL`,
  )
  const nextMap = new Map<string, LocationEntry>()
  for (const loc of locRes.rows as any[]) {
    nextMap.set(loc.slug, {
      id: String(loc.id),
      kind: loc.kind,
      name: loc.name,
      stateCode: loc.state ?? '',
    })
  }
  locationMap = nextMap
  cachedAt = Date.now()
}

export async function resolveRoute(segments: string[]): Promise<ResolvedRoute> {
  await ensureCaches()
  const ss = serviceSet!
  const bs = brandSet!
  const lm = locationMap!

  if (segments.length === 0) return { type: 'not-found' }

  // ── Services path (/services/*) ───────────────────────────────────────────────
  if (segments[0] === 'services') {
    const rest = segments.slice(1)
    if (rest.length === 0) return { type: 'services-index' }
    const [svc, state, city] = rest
    if (rest.length === 1) {
      if (ss.has(svc)) return { type: 'service-pillar', serviceSlug: svc }
      return { type: 'not-found' }
    }
    if (rest.length === 2) {
      if (ss.has(svc) && lm.get(state)?.kind === 'state')
        return { type: 'service-state', serviceSlug: svc, stateSlug: state }
      return { type: 'not-found' }
    }
    if (rest.length === 3) {
      const cLoc = lm.get(city)
      if (ss.has(svc) && lm.get(state)?.kind === 'state' && (cLoc?.kind === 'metro' || cLoc?.kind === 'city'))
        return { type: 'service-city-directory', serviceSlug: svc, stateSlug: state, citySlug: city }
      return { type: 'not-found' }
    }
    return { type: 'not-found' }
  }

  // ── Brands path (/brands/*) ───────────────────────────────────────────────────
  if (segments[0] === 'brands') {
    const rest = segments.slice(1)
    if (rest.length === 0) return { type: 'brands-index' }
    const [brand, state, city] = rest
    if (rest.length === 1) {
      if (bs.has(brand)) return { type: 'brand-pillar', brandSlug: brand }
      return { type: 'not-found' }
    }
    if (rest.length === 2) {
      if (bs.has(brand) && lm.get(state)?.kind === 'state')
        return { type: 'brand-state', brandSlug: brand, stateSlug: state }
      return { type: 'not-found' }
    }
    if (rest.length === 3) {
      const cLoc = lm.get(city)
      if (bs.has(brand) && lm.get(state)?.kind === 'state' && (cLoc?.kind === 'metro' || cLoc?.kind === 'city'))
        return { type: 'brand-city-directory', brandSlug: brand, stateSlug: state, citySlug: city }
      return { type: 'not-found' }
    }
    return { type: 'not-found' }
  }

  // ── Everything else ──────────────────────────────────────────────────────────
  // The catch-all serves the Services and Brands paths and nothing else. Bare
  // location urls (`/alabama`, `/alabama/birmingham-al`) used to land here and
  // now 404 by design: those pages moved under `/clinics/*` and have their own
  // route files. See the note at the top of this file.
  return { type: 'not-found' }
}

/**
 * Slug validation for the `/clinics/[state]` and `/clinics/[state]/[city]` route
 * files.
 *
 * Those are real pages now, not catch-all routes, so they cannot ask
 * `resolveRoute` what a bare `/alabama` is: that shape deliberately resolves to
 * not-found. They ask here instead, against the same cached locations map, so a
 * junk slug still 404s rather than rendering an empty hub.
 */
export async function isStateSlug(slug: string): Promise<boolean> {
  await ensureCaches()
  return locationMap!.get(slug)?.kind === 'state'
}

/** Companion to `isStateSlug` for the city level. Mirrors exactly what the old
 * `city-hub` branch checked: a real state slug, and a slug that is a metro or a
 * city. Whether that city actually sits in that state is settled by `getCityHub`,
 * as it always was. */
export async function isCitySlug(stateSlug: string, citySlug: string): Promise<boolean> {
  await ensureCaches()
  const lm = locationMap!
  if (lm.get(stateSlug)?.kind !== 'state') return false
  const kind = lm.get(citySlug)?.kind
  return kind === 'metro' || kind === 'city'
}

export type LocationPrerenderParams = {
  stateSlugs: string[]
  topCities: Array<{ citySlug: string; stateSlug: string }>
}

/**
 * The state and city slug lists used by generateStaticParams.
 *
 * Lives here rather than in the page files because two separate routes need the
 * exact same lists -- `/clinics/[state]` and `/clinics/[state]/[city]` -- and the
 * city ranking below is subtle enough that a second copy would drift. Both call
 * this; nobody re-implements it.
 */
export async function getLocationPrerenderParams(): Promise<LocationPrerenderParams> {
  const payload = await getPayloadInstance()
  const pool = (payload.db as any).pool
  const [locRes, activeCitiesRes] = await Promise.all([
    /**
     * Raw SQL and unbounded, for the same reason `ensureCaches` above is: this
     * was `payload.find({ collection: 'locations', limit: 5000 })`, and there
     * are 6,098 location rows. Payload orders newest-first, so 1,098 rows fell
     * off the end -- including 50 of the 51 STATE rows, the oldest rows in the
     * table. Every state page silently dropped out of generateStaticParams and
     * fell back to on-demand ISR.
     *
     * That was survivable while a state hub was a thin page. It is not now that
     * state hubs render a full city grid, and it is exactly the cliff the
     * comment at the top of this file describes. A larger number would only move
     * the cliff, so there is no limit. Five columns over ~6k rows is a few
     * hundred KB, and payload.find would also have joined every relationship
     * field on the collection regardless of depth.
     */
    pool.query(
      `SELECT id, slug, kind, name, state FROM locations WHERE slug IS NOT NULL`,
    ),
    /**
     * Grouped, not DISTINCT, because this count is now what ranks the
     * pre-render list. It used to rank on `locations.provider_count`, which is
     * 0 or null on 6,086 of the 6,098 rows (the providers table was dropped),
     * so "top 200 cities" was really an arbitrary 200. Published clinic count
     * is the number that actually says which city pages matter.
     */
    pool.query(
      `SELECT city, state, count(*)::int AS n
         FROM clinics
        WHERE status = 'published'
          AND city IS NOT NULL AND city <> ''
          AND state IS NOT NULL AND state <> ''
        GROUP BY city, state`,
    ),
  ])

  const stateSlugs: string[] = []
  const stateCodeToSlug = new Map<string, string>()
  const cityEntries: Array<{ citySlug: string; stateSlug: string; clinicCount: number }> = []
  const cityKeyToSlug = new Map<string, string>()

  for (const loc of locRes.rows as any[]) {
    if (loc.kind === 'state') {
      stateSlugs.push(loc.slug)
      if (loc.state) stateCodeToSlug.set((loc.state as string).toLowerCase(), loc.slug)
    } else if (loc.kind === 'metro' || loc.kind === 'city') {
      const key = `${(loc.name as string).toLowerCase().replace(/\s+city$/i, '').trim()},${(loc.state ?? '').toLowerCase()}`
      cityKeyToSlug.set(key, loc.slug)
    }
  }

  // Published clinics per city slug. Doubles as the "is this city active at all"
  // set, so a city with no clinics is never a pre-render candidate.
  const clinicCountBySlug = new Map<string, number>()
  for (const clinic of activeCitiesRes.rows as any[]) {
    const key = `${(clinic.city ?? '').toLowerCase().replace(/\s+city$/i, '').trim()},${(clinic.state ?? '').toLowerCase()}`
    const citySlug = cityKeyToSlug.get(key)
    if (citySlug) {
      clinicCountBySlug.set(citySlug, (clinicCountBySlug.get(citySlug) ?? 0) + Number(clinic.n ?? 0))
    }
  }

  for (const loc of locRes.rows as any[]) {
    if (loc.kind === 'metro' || loc.kind === 'city') {
      const stateSlug = stateCodeToSlug.get((loc.state ?? '').toLowerCase()) ?? ''
      cityEntries.push({
        citySlug: loc.slug,
        stateSlug,
        clinicCount: clinicCountBySlug.get(loc.slug) ?? 0,
      })
    }
  }

  const activeCitySlugs = new Set<string>(clinicCountBySlug.keys())

  const activeCityEntries = cityEntries.filter((e) => activeCitySlugs.has(e.citySlug) && e.stateSlug)
  // Already capped (unlike the clinic/provider param lists, which were not).
  // Env-tunable for parity with PRERENDER_CLINIC_LIMIT / PRERENDER_PROVIDER_LIMIT
  // so all three build-size knobs can be adjusted without a code change.
  const TOP_FIND_CITIES = Math.max(
    0,
    parseInt(process.env.PRERENDER_CITY_LIMIT || '200', 10) || 200,
  )
  // Ties broken by slug so the pre-render list is stable across builds.
  const rankedCities = [...activeCityEntries].sort(
    (a, b) => b.clinicCount - a.clinicCount || a.citySlug.localeCompare(b.citySlug),
  )
  const topFindCities = rankedCities.slice(0, TOP_FIND_CITIES)

  return {
    stateSlugs,
    topCities: topFindCities.map(({ citySlug, stateSlug }) => ({ citySlug, stateSlug })),
  }
}

// getAllRoutePaths — used by generateStaticParams.
// Pre-renders only paths backed by real data; ISR handles the rest on first visit.
export async function getAllRoutePaths(): Promise<string[][]> {
  const payload = await getPayloadInstance()
  const [svcRes, brandRes] = await Promise.all([
    payload.find({ collection: 'services', limit: 500, depth: 0 }),
    payload.find({ collection: 'brands', limit: 500, depth: 0 }),
  ])

  const svcSlugs: string[] = svcRes.docs.map((t: any) => t.slug)
  const brandSlugs: string[] = brandRes.docs.map((b: any) => b.slug)

  const paths: string[][] = []

  // Money pages (service/brand × state/city) are NOT pre-rendered: rendering the
  // full matrix at build time OOMs the build container (1 CPU, limited heap).
  // They serve on-demand via ISR instead — the runtime spike is handled by the
  // split sitemap, the heap bump, and the lighter per-page queries.

  // ── Services path ──────────────────────────────────────────────────────────
  paths.push(['services'])
  svcSlugs.forEach((t) => paths.push(['services', t]))

  // ── Brands path ────────────────────────────────────────────────────────────
  paths.push(['brands'])
  brandSlugs.forEach((b) => paths.push(['brands', b]))

  // State and city hubs are NOT pushed here any more. They are served by
  // `app/(frontend)/clinics/[state]/page.tsx` and `.../[city]/page.tsx`, which
  // have their own generateStaticParams calling getLocationPrerenderParams.
  // Emitting them here would ask the catch-all to prerender urls that now 404.

  return paths
}
