/**
 * Shared lean clinic-listing fetch, raw SQL instead of payload.find().
 *
 * Why: payload.find() on 'clinics' always joins in every relationship/array
 * field (brandsOffered, servicesOffered, clinicPhotoUrls,
 * sourceUrls) regardless of `depth`, because those live in child tables and
 * Payload's Postgres adapter fetches the raw relation rows unconditionally.
 * For a brand/service page with no location filter, that means sorting and
 * joining across every matching clinic (thousands, for a popular brand like
 * Botox) before the LIMIT trims it down. This mirrors the fix already
 * verified in lib/hero-queries.ts: select only the columns mapClinic()
 * actually uses, and only join relations for the clinics that already won
 * the ORDER BY + LIMIT (via clinics_status_rating_idx), not the whole
 * matching set.
 */

import {
  METERS_PER_MILE,
  boundingBoxForRadius,
  clinicBoundingBoxSql,
  clinicDistanceMeters,
  clinicDistanceMetersHaversine,
  isPostGisAvailable,
} from './search-sql'
import { NEAR_BUCKET_MILES, NEAR_ME_BUCKET_MILES } from './merit'
import { BoundedTtlCache } from './bounded-ttl-cache'

/**
 * Total-match counts, keyed by filter rather than by page.
 *
 * 5 minutes matches lib/listing-cache.ts and the CDN s-maxage on these routes,
 * so a count can never be staler than the page it labels. 300 entries is the
 * number of distinct filter combinations in flight, not the number of pages,
 * which is why it can be small: every page of one filtered listing shares a key.
 * A stale count only ever mis-states "N remaining" for a few minutes; it cannot
 * hide or duplicate a clinic, because the rows themselves are never cached here.
 */
const countCache = new BoundedTtlCache<number>(300, 5 * 60 * 1000)

/**
 * Distance-band ordering for the "near me" default listing (2026-08-15).
 *
 * The band WIDTH is defined in lib/merit.ts, because the browser needs the same
 * number and that module is safe to bundle client-side while this one is not.
 * The band itself is computed here, in SQL, because it has to be correct across
 * the whole matching set rather than the 24 rows a page happens to have loaded.
 * Merit within a band is then refined in the browser, where the full merit
 * proxy already lives (sortClinicsByMeritWithinBuckets).
 */

/**
 * Past this distance, "near you" stops meaning anything, so every remaining
 * clinic shares one final band and falls back to plain merit order. This also
 * bounds the work: the bounding-box test in front of the distance expression
 * short-circuits, so the trigonometry only runs for rows inside the box.
 */
export const NEAR_MAX_MILES = 100

/** Band index assigned to everything outside NEAR_MAX_MILES. Sorts last. */
const FAR_BUCKET = 9999

export type LeanClinicRow = {
  id: number
  clinic_name: string
  slug: string
  tagline: string | null
  city: string
  state: string
  neighborhood: string | null
  aggregate_rating: number | null
  aggregate_rating_count: number | null
  latitude: number | null
  longitude: number | null
  clinic_type: string | null
  starting_price: number | null
  photo_url: string | null
  brands_offered: number[]
  services_offered: number[]
  /**
   * Miles from the `near` point, present only when `near` was passed AND the
   * clinic falls inside NEAR_MAX_MILES. Null means "not near / not measured",
   * which the card reads as "show no distance line" rather than "0 miles".
   */
  distance_miles?: number | null
  /** The 5-mile band this row sorted into. Absent when `near` was not passed. */
  geo_rank?: number
}

export type LeanListingFilters = {
  brandIds?: number[]
  serviceIds?: number[]
  clinicTypes?: string[]
  minRating?: number
  /** All three or none. Radius without coordinates cannot be resolved. */
  radiusMiles?: number
  lat?: number
  lng?: number
  /**
   * Sort origin for distance-band ordering. Independent of the radius FILTER
   * above: `near` never removes a clinic from the results, it only decides what
   * comes first. A visitor with no radius filter set still gets their own area
   * at the top of the page, which is the whole point.
   */
  near?: { lat: number; lng: number }
}

/** The clinic_type values the Clinics collection allows. Anything else in the
 *  query string is dropped rather than passed to SQL. */
const CLINIC_TYPES = ['medspa', 'dermatology', 'plastic-surgery', 'dental-aesthetics', 'other']

/**
 * The radius filter as Payload `where` clauses.
 *
 * Payload cannot express great-circle distance, so the routes that run on
 * payload.find() get the bounding box only (added 2026-08-08). The box is a
 * square around the circle, so it over-selects at the corners; the browser then
 * applies the exact haversine in applyListingFilters and drops them. The visible
 * list is therefore correct, but the reported total counts the box, which can
 * run a little high. Routes on the lean SQL path get the exact circle instead.
 */
export function boundingBoxWhere(filters: LeanListingFilters): any[] {
  if (filters.radiusMiles == null || filters.lat == null || filters.lng == null) return []
  const box = boundingBoxForRadius(filters.lat, filters.lng, filters.radiusMiles)
  return [
    { latitude: { greater_than_equal: box.minLat } },
    { latitude: { less_than_equal: box.maxLat } },
    { longitude: { greater_than_equal: box.minLng } },
    { longitude: { less_than_equal: box.maxLng } },
  ]
}

function idList(raw: string | null): number[] | undefined {
  if (!raw) return undefined
  const ids = raw
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((n) => Number.isInteger(n) && n > 0)
  return ids.length > 0 ? ids : undefined
}

/**
 * Reads the listing-filter query string that ListingFilters writes (brand, svc,
 * type, rating) into fetchLeanClinics options. Shared so every listing route
 * parses them identically, and so a junk value can never reach SQL: ids must be
 * positive integers, clinic types must be known, rating must be a real number.
 *
 * lat/lng serve two separate jobs and are read for both. With a valid `radius`
 * they are the centre of the radius FILTER. On their own they are the origin
 * for distance-band ORDERING (`near`), which is how the IP-located default
 * listing works: no clinic is excluded, the visitor's area just sorts first.
 */
export function parseLeanListingFilters(searchParams: URLSearchParams): LeanListingFilters {
  const types = (searchParams.get('type') ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter((v) => CLINIC_TYPES.includes(v))

  const rating = Number(searchParams.get('rating'))

  // Distance needs all three, and every one has to be a real number before it
  // reaches SQL: the distance and bounding-box helpers interpolate these as
  // literals rather than bind params, so validation here is what keeps that safe.
  const radius = Number(searchParams.get('radius'))
  const lat = Number(searchParams.get('lat'))
  const lng = Number(searchParams.get('lng'))
  const hasPoint =
    Number.isFinite(lat) && lat >= -90 && lat <= 90 &&
    Number.isFinite(lng) && lng >= -180 && lng <= 180
  const hasGeo = hasPoint && Number.isFinite(radius) && radius > 0

  return {
    brandIds: idList(searchParams.get('brand')),
    serviceIds: idList(searchParams.get('svc')),
    clinicTypes: types.length > 0 ? types : undefined,
    minRating: Number.isFinite(rating) && rating > 0 ? rating : undefined,
    ...(hasGeo ? { radiusMiles: radius, lat, lng } : {}),
    ...(hasPoint ? { near: { lat, lng } } : {}),
  }
}

export async function fetchLeanClinics(
  pool: any,
  opts: {
    relFilter?: { path: 'brandsOffered' | 'servicesOffered'; id: number }
    stateCode?: string
    cityLike?: string
    limit: number
    offset?: number
    /**
     * Listing-filter params, added 2026-08-07. These used to run in the browser
     * over whatever page happened to be loaded (24 rows of up to 39,669), so
     * picking a brand almost always returned nothing. Doing them here means the
     * filter sees every matching clinic and totalCount stays truthful.
     *
     * brandIds / serviceIds are OR within a list and AND across the two, which
     * matches how the panel reads: "any of these brands" and "any of these
     * services". Both hit clinics_rels, the same table relFilter already uses.
     */
    brandIds?: number[]
    serviceIds?: number[]
    clinicTypes?: string[]
    minRating?: number
    /**
     * Radius filter, added 2026-08-08. All three or none. The query narrows on
     * the indexed latitude/longitude columns first (a box around the point) and
     * only then computes the exact great-circle distance on what survives, so a
     * radius search no longer runs trigonometry over the whole table.
     */
    radiusMiles?: number
    lat?: number
    lng?: number
    /**
     * Distance-band sort origin, added 2026-08-15 for the IP-located default
     * listing. Unlike radiusMiles above this is a SORT, not a filter: the
     * result set is identical, only the order changes. See NEAR_BUCKET_MILES.
     */
    near?: { lat: number; lng: number }
  },
): Promise<{ rows: LeanClinicRow[]; totalCount: number }> {
  const conditions: string[] = [`c.status = 'published'`]
  const params: unknown[] = []

  if (opts.relFilter) {
    params.push(opts.relFilter.id)
    const col = opts.relFilter.path === 'brandsOffered' ? 'brands_id' : 'services_id'
    conditions.push(
      `EXISTS (SELECT 1 FROM clinics_rels cr WHERE cr.parent_id = c.id AND cr.${col} = $${params.length})`,
    )
  }
  if (opts.stateCode) {
    params.push(opts.stateCode)
    conditions.push(`c.state = $${params.length}`)
  }
  if (opts.cityLike) {
    params.push(opts.cityLike)
    conditions.push(`c.city ILIKE $${params.length}`)
  }
  if (opts.brandIds && opts.brandIds.length > 0) {
    params.push(opts.brandIds)
    conditions.push(
      `EXISTS (SELECT 1 FROM clinics_rels cr WHERE cr.parent_id = c.id AND cr.brands_id = ANY($${params.length}::int[]))`,
    )
  }
  if (opts.serviceIds && opts.serviceIds.length > 0) {
    params.push(opts.serviceIds)
    conditions.push(
      `EXISTS (SELECT 1 FROM clinics_rels cr WHERE cr.parent_id = c.id AND cr.services_id = ANY($${params.length}::int[]))`,
    )
  }
  if (opts.clinicTypes && opts.clinicTypes.length > 0) {
    params.push(opts.clinicTypes)
    // clinic_type is a Postgres enum (enum_clinics_clinic_type), so it has no
    // operator against text[]. Cast the column, not the array: casting the
    // array to the enum type would throw on any value the enum does not have,
    // and parseLeanListingFilters cannot guarantee that for a hand-typed URL.
    conditions.push(`c.clinic_type::text = ANY($${params.length}::text[])`)
  }
  if (opts.minRating != null) {
    params.push(opts.minRating)
    conditions.push(`c.aggregate_rating >= $${params.length}`)
  }
  if (opts.radiusMiles != null && opts.lat != null && opts.lng != null) {
    // Box first (indexed columns), exact circle second. The lat/lng/radius
    // values are interpolated as numeric literals, never bind params, which is
    // the same contract the distance helpers in search-sql.ts document; they
    // are validated in parseLeanListingFilters before they get here.
    const geoEnabled = await isPostGisAvailable(pool)
    const meters = opts.radiusMiles * METERS_PER_MILE
    const distExpr = geoEnabled
      ? clinicDistanceMeters(opts.lat, opts.lng, 'c')
      : clinicDistanceMetersHaversine(opts.lat, opts.lng, 'c')
    conditions.push(clinicBoundingBoxSql(opts.lat, opts.lng, opts.radiusMiles, 'c'))
    conditions.push(`${distExpr} <= ${meters}`)
  }

  // Distance-band ordering (see NEAR_BUCKET_MILES). The bounding-box test is
  // the first branch of the CASE so Postgres short-circuits: the trigonometry
  // only runs for rows already inside the box, not for every matching clinic.
  // Clinics with NULL or zero coordinates fail the box test and land in the
  // far band, which is the correct place for a clinic we cannot locate.
  let geoSelect = ''
  let geoOrder = ''
  let geoOrderOuter = ''
  if (opts.near) {
    const geoEnabled = await isPostGisAvailable(pool)
    const { lat, lng } = opts.near
    const distExpr = geoEnabled
      ? clinicDistanceMeters(lat, lng, 'c')
      : clinicDistanceMetersHaversine(lat, lng, 'c')
    const inBox = clinicBoundingBoxSql(lat, lng, NEAR_MAX_MILES, 'c')
    /**
     * A radius filter means the set is already local, so the bands have to be
     * finer or they stop separating anything: inside 10 miles a 5-mile band put
     * every page-1 clinic in one group and merit alone decided the order (see
     * NEAR_ME_BUCKET_MILES). Without a radius the listing is unbounded and the
     * wider band is still correct, which is what leaves state and city pages
     * untouched.
     *
     * The browser re-sorts within these same bands, so it must be told the same
     * width. Both sides derive it from the same test: radius set or not.
     */
    const bucketMiles = opts.radiusMiles != null ? NEAR_ME_BUCKET_MILES : NEAR_BUCKET_MILES
    const bucketMeters = bucketMiles * METERS_PER_MILE
    // The box is a square around the circle, so its corners reach past
    // NEAR_MAX_MILES. Clamping keeps those corner rows in the last real band
    // instead of inventing bands beyond the cutoff.
    const maxBucket = Math.floor(NEAR_MAX_MILES / bucketMiles)
    geoSelect = `,
             CASE WHEN ${inBox} THEN LEAST(floor(${distExpr} / ${bucketMeters}), ${maxBucket})
                  ELSE ${FAR_BUCKET} END AS geo_rank,
             CASE WHEN ${inBox} THEN ${distExpr} / ${METERS_PER_MILE}
                  ELSE NULL END AS distance_miles`
    // Postgres allows ORDER BY on an output column alias, so the CASE is
    // evaluated once per row rather than twice.
    geoOrder = 'geo_rank ASC, '
    geoOrderOuter = 'm.geo_rank ASC, '
  }

  const where = conditions.join(' AND ')
  const limit = opts.limit
  const offset = opts.offset ?? 0
  params.push(limit, offset)

  /**
   * `c.id DESC` closes the ORDER BY, added 2026-08-15.
   *
   * `aggregate_rating_count DESC, created_at DESC` was believed to be a total
   * order and is not: the bulk-imported clinics share a created_at down to the
   * timestamp and most carry zero reviews, so tens of thousands of rows tie on
   * both keys. Postgres is then free to return them in any order, and it does
   * — a clinic on page 1 came back again on page 2 in staging, reproduced by
   * scratchpad verification against the real data.
   *
   * Distance bands did not cause this, they exposed it: banding collapses a
   * city into one large tie group where the old keys separate nothing. Any
   * unfiltered listing had the same latent bug.
   *
   * `has_photo DESC` leads the tiebreakers as of 2026-09-03 (founder call): a
   * clinic with no photo should not sit at the top of a city page. It goes
   * AFTER geo_rank so a photo can never pull a far clinic above a near one --
   * distance stays the primary signal -- and it reads a stored column rather
   * than an EXISTS() so the sort is still served by
   * clinics_status_photo_rating_idx instead of scanning every matching row.
   *
   * `NULLS LAST` on the review count matters and was missing. Postgres sorts
   * NULLs FIRST under DESC, and 38,769 of 57,608 clinics have no review count
   * at all, so every listing was putting review-less clinics ABOVE clinics with
   * reviews -- in Houston that buried a 5,924-review clinic under 205 empty
   * ones. The index carries the same NULLS LAST or the sort stops being
   * index-driven.
   */

  const res = await pool.query(
    `
    WITH matched AS (
      SELECT c.id, c.clinic_name, c.slug, c.tagline, c.city, c.state, c.neighborhood,
             c.aggregate_rating, c.aggregate_rating_count,
             c.latitude, c.longitude, c.clinic_type, c.starting_price,
             c.has_photo,
             c.created_at${geoSelect}
        FROM clinics c
       WHERE ${where}
       ORDER BY ${geoOrder}c.has_photo DESC, c.aggregate_rating_count DESC NULLS LAST, c.created_at DESC, c.id DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}
    )
    SELECT m.*,
           (SELECT cpu.url FROM clinics_clinic_photo_urls cpu
             WHERE cpu._parent_id = m.id ORDER BY cpu._order ASC LIMIT 1) AS photo_url,
           COALESCE(
             (SELECT array_agg(cr.brands_id ORDER BY cr."order")
                FROM clinics_rels cr WHERE cr.parent_id = m.id AND cr.path = 'brandsOffered'),
             ARRAY[]::int[]
           ) AS brands_offered,
           COALESCE(
             (SELECT array_agg(cr.services_id ORDER BY cr."order")
                FROM clinics_rels cr WHERE cr.parent_id = m.id AND cr.path = 'servicesOffered'),
             ARRAY[]::int[]
           ) AS services_offered
      FROM matched m
     ORDER BY ${geoOrderOuter}m.has_photo DESC, m.aggregate_rating_count DESC NULLS LAST, m.created_at DESC, m.id DESC
    `,
    params,
  )

  // Exact total count for pagination -- same filter, no ORDER BY/LIMIT needed.
  //
  // Cached per filter, NOT per page (2026-08-17). The count cannot change
  // between page 2 and page 3 of one session, yet every "load more" click was
  // paying for it again: measured at ~330ms on staging against 39,669 published
  // clinics, because an unfiltered count has no index to use and scans the lot.
  // The key is the WHERE clause plus its parameters, so any change of filter,
  // state or city is a different key and still gets an exact number.
  const countParams = params.slice(0, params.length - 2)
  const countKey = `${where}|${JSON.stringify(countParams)}`
  const cachedCount = countCache.get(countKey)
  if (cachedCount !== undefined) {
    return { rows: res.rows, totalCount: cachedCount }
  }

  const countRes = await pool.query(
    `SELECT count(*)::int AS n FROM clinics c WHERE ${where}`,
    countParams,
  )
  const totalCount = countRes.rows[0]?.n ?? 0
  countCache.set(countKey, totalCount)

  return { rows: res.rows, totalCount }
}

/**
 * node-postgres hands back Postgres `numeric` columns as STRINGS (to avoid the
 * precision loss of a JS float), so `aggregate_rating` arrives as "4.2", not 4.2.
 * payload.find() coerced these for us; raw SQL does not. Consumers treat them as
 * numbers — `aggregateRating.toFixed(1)` in DirectoryClinicCard threw
 * "toFixed is not a function" and killed the build on the first service page it
 * pre-rendered. Coerce here, at the single boundary between SQL and the app.
 */
export function num(v: unknown): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

/**
 * A lean SQL row in the JSON shape the listing API routes return.
 *
 * Extracted 2026-08-15, when the brand and service listing routes moved off
 * payload.find(). They had each carried their own copy of this mapping, and
 * three hand-written copies of the same object is how one of them quietly ends
 * up missing a field. `lookupSlugs` is passed in rather than imported so this
 * module stays free of the location-slug dependency.
 */
export function leanRowToListingJson(
  row: LeanClinicRow,
  slugs: { citySlug: string; stateSlug: string },
): Record<string, unknown> {
  return {
    id: String(row.id),
    slug: row.slug,
    citySlug: slugs.citySlug,
    stateSlug: slugs.stateSlug,
    clinicName: row.clinic_name,
    tagline: row.tagline ?? undefined,
    city: row.city,
    state: row.state,
    neighborhood: row.neighborhood ?? undefined,
    // pg returns numeric columns as strings; the cards call .toFixed() on them.
    aggregateRating: num(row.aggregate_rating) ?? undefined,
    aggregateRatingCount: num(row.aggregate_rating_count) ?? undefined,
    photoUrl: row.photo_url ?? undefined,
    latitude: num(row.latitude) ?? 0,
    longitude: num(row.longitude) ?? 0,
    providerCount: 0,
    clinicType: row.clinic_type ?? undefined,
    startingPrice: num(row.starting_price) ?? undefined,
    brandsOffered: (row.brands_offered ?? []).map((b) => String(b)),
    servicesOffered: (row.services_offered ?? []).map((s) => String(s)),
    distanceMiles: num(row.distance_miles) ?? undefined,
  }
}

export function leanRowToMapClinicInput(row: LeanClinicRow): any {
  return {
    id: row.id,
    clinicName: row.clinic_name,
    slug: row.slug,
    tagline: row.tagline,
    city: row.city,
    state: row.state,
    neighborhood: row.neighborhood,
    aggregateRating: num(row.aggregate_rating),
    aggregateRatingCount: num(row.aggregate_rating_count),
    latitude: num(row.latitude),
    longitude: num(row.longitude),
    clinicType: row.clinic_type,
    startingPrice: num(row.starting_price),
    clinicPhotoUrls: row.photo_url ? [{ url: row.photo_url }] : [],
    brandsOffered: row.brands_offered,
    servicesOffered: row.services_offered,
    distanceMiles: num(row.distance_miles),
  }
}
