import { NEAR_ME_RADIUS_MILES } from '@/lib/merit'

export type ListingItemKind = 'provider' | 'clinic'

export type ListingFilterValues = {
  radius: number | null
  rating: number | null
  virtual: boolean
  priceMin: number
  priceMax: number
  languages: string[]
  clinicTypes: string[]
  loyaltyPrograms: string[]
  brands: string[]
  services: string[]
  lat: number | null
  lng: number | null
}

export type ScoredListingResult<T> = {
  item: T
  score: number
  distanceMiles: number | null
}

export const PRICE_MIN = 0
export const PRICE_MAX = 2000

export const DEFAULT_LISTING_FILTERS: ListingFilterValues = {
  radius: null,
  rating: null,
  virtual: false,
  priceMin: PRICE_MIN,
  priceMax: PRICE_MAX,
  languages: [],
  clinicTypes: [],
  loyaltyPrograms: [],
  brands: [],
  services: [],
  lat: null,
  lng: null,
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asNumber(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : undefined
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)).filter(Boolean) : []
}

export function getListingCoordinates(item: unknown, kind: ListingItemKind): { lat: number; lng: number } | null {
  const root = asRecord(item)
  const source = kind === 'provider' ? asRecord(root.clinic) : root
  const lat = asNumber(source.latitude)
  const lng = asNumber(source.longitude)
  if (lat == null || lng == null || lat === 0 || lng === 0) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return { lat, lng }
}

export function getListingLanguages(item: unknown): string[] {
  return asStringArray(asRecord(item).languages)
}

export function getListingClinicType(item: unknown): string | undefined {
  const value = asRecord(item).clinicType
  return typeof value === 'string' && value.trim() ? value : undefined
}

export function getListingLoyaltyPrograms(item: unknown): string[] {
  return asStringArray(asRecord(item).loyaltyPrograms)
}

export function getListingBrandIds(item: unknown): string[] {
  return asStringArray(asRecord(item).brandsOffered)
}

export function getListingServiceIds(item: unknown): string[] {
  const root = asRecord(item)
  // Clinics have servicesOffered (IDs); providers have treatmentIds (IDs)
  const fromServices = asStringArray(root.servicesOffered)
  const fromTreatments = asStringArray(root.treatmentIds)
  return fromServices.length > 0 ? fromServices : fromTreatments
}

function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const earthRadiusMiles = 3959
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2
  return earthRadiusMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function intersects(values: string[], filters: string[]): boolean {
  if (filters.length === 0) return true
  const normalized = new Set(values.map((v) => v.toLowerCase()))
  return filters.some((v) => normalized.has(v.toLowerCase()))
}

function isVirtualMatch(item: unknown, kind: ListingItemKind): boolean {
  const root = asRecord(item)
  if (kind === 'provider') return root.offersVirtualConsult === true
  // Clinics no longer carry serviceType or offersVirtualConsult (both removed
  // 2026-08-23; serviceType was 'In-Person' on every row, offersVirtualConsult
  // was unused). No clinic can match a virtual-consult filter anymore.
  return false
}

export function applyListingFilters<T>(
  items: T[],
  filters: ListingFilterValues,
  kind: ListingItemKind,
): { items: T[]; scored: ScoredListingResult<T>[] } {
  const scored = items
    .map((item) => {
      const root = asRecord(item)
      const coords = getListingCoordinates(item, kind)
      const distanceMiles =
        filters.radius != null && filters.lat != null && filters.lng != null && coords
          ? haversineMiles(filters.lat, filters.lng, coords.lat, coords.lng)
          : null
      const rating = asNumber(root.aggregateRating) ?? 0
      const score = rating + (distanceMiles == null ? 0 : Math.max(0, 1 - distanceMiles / Math.max(filters.radius ?? 50, 1)))
      return { item, score, distanceMiles }
    })
    .filter(({ item, distanceMiles }) => {
      const root = asRecord(item)

      if (filters.radius != null && filters.lat != null && filters.lng != null) {
        if (distanceMiles == null || distanceMiles > filters.radius) return false
      }

      if (filters.rating != null && (asNumber(root.aggregateRating) ?? 0) < filters.rating) return false

      if (filters.virtual && !isVirtualMatch(item, kind)) return false

      const startingPrice = asNumber(root.startingPrice)
      if (startingPrice != null && (startingPrice < filters.priceMin || startingPrice > filters.priceMax)) return false

      if (!intersects(getListingLanguages(item), filters.languages)) return false

      if (kind === 'clinic' && filters.clinicTypes.length > 0) {
        const clinicType = getListingClinicType(item)
        if (!clinicType || !filters.clinicTypes.includes(clinicType)) return false
      }

      if (kind === 'provider' && !intersects(getListingLoyaltyPrograms(item), filters.loyaltyPrograms)) return false

      if (!intersects(getListingBrandIds(item), filters.brands)) return false

      if (!intersects(getListingServiceIds(item), filters.services)) return false

      return true
    })

  return { items: scored.map((r) => r.item), scored }
}

/**
 * The near-me default folded into the panel's filters (2026-09-10).
 *
 * Returns the filters UNCHANGED unless every condition holds: this listing is
 * one of the three pillar pages, a ZIP has been resolved, and the visitor has
 * not picked a distance themselves. That last one is the important one -- an
 * explicit choice in the filter panel always wins over the automatic default,
 * and it is also what keeps this reversible: pick a distance and the panel is
 * back in charge of both the radius and the point.
 *
 * This is deliberately NOT routed through ListingFilters.writeFilters(), which
 * pushes radius/lat/lng into the URL. The automatic default must never touch
 * the address bar; only a user action in the panel may.
 * See docs/ZIP-NEAR-ME-LISTING-2026-09-10.md hard rule 3.
 */
export function withNearMeDefault(
  filters: ListingFilterValues,
  near: { enabled: boolean; ready: boolean; lat: number | null; lng: number | null },
): ListingFilterValues {
  if (!near.enabled || !near.ready) return filters
  if (near.lat == null || near.lng == null) return filters
  if (filters.radius != null) return filters
  return { ...filters, lat: near.lat, lng: near.lng, radius: NEAR_ME_RADIUS_MILES }
}

/**
 * The subset of the filters the listing APIs run in SQL, as query params.
 *
 * Added 2026-08-07. Filtering used to happen only in the browser, over the one
 * page of rows that happened to be loaded, so picking a brand out of 200 on a
 * 39,669-clinic listing almost always returned nothing.
 *
 * Radius joined them on 2026-08-08. The server narrows to a latitude/longitude
 * box around the point; applyListingFilters below still runs the exact haversine
 * on what comes back, which is what trims the box down to a real circle.
 *
 * Param names match what ListingFilters already writes to the URL, so a
 * filtered listing is still a shareable link.
 */
export function toServerFilterParams(filters: ListingFilterValues): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.brands.length > 0) params.set('brand', filters.brands.join(','))
  if (filters.services.length > 0) params.set('svc', filters.services.join(','))
  if (filters.clinicTypes.length > 0) params.set('type', filters.clinicTypes.join(','))
  if (filters.rating != null) params.set('rating', String(filters.rating))
  // Coordinates now travel even without a radius (2026-08-15). They used to be
  // sent only alongside `radius`, because distance was purely a filter. They
  // are also the origin the server orders the default listing around, so a
  // visitor who has set no filter at all still needs them to arrive; holding
  // them back until someone picks a radius is what kept the listing national.
  // Without `radius` the server treats the point as a sort origin only, and no
  // clinic is excluded.
  if (filters.lat != null && filters.lng != null) {
    params.set('lat', roundForCache(filters.lat))
    params.set('lng', roundForCache(filters.lng))
    if (filters.radius != null) params.set('radius', String(filters.radius))
  }
  return params
}

/**
 * Coordinates are rounded to 2 decimal places before they reach the server.
 *
 * This is what makes the listing response cache useful. Raw coordinates differ
 * slightly between ISP blocks inside one city, and a key that varies per
 * visitor caches nothing. Two decimals is about 1.1km, so a city collapses to a
 * handful of keys instead of thousands.
 *
 * The precision loss costs nothing here: results are grouped into 5-mile
 * (8km) distance bands, so a 1.1km shift almost never moves a clinic across a
 * band boundary. Sending a coarser location also means a precise one is not
 * sitting in URLs and server logs.
 */
function roundForCache(value: number): string {
  return String(Number(value.toFixed(2)))
}

/** Stable string for effect deps: changes only when a server-handled filter does. */
export function serverFilterKey(filters: ListingFilterValues): string {
  return toServerFilterParams(filters).toString()
}

export function getActiveListingFilterCount(filters: ListingFilterValues): number {
  let count = 0
  if (filters.radius != null) count += 1
  if (filters.rating != null) count += 1
  if (filters.virtual) count += 1
  if (filters.priceMin !== PRICE_MIN || filters.priceMax !== PRICE_MAX) count += 1
  if (filters.languages.length > 0) count += 1
  if (filters.clinicTypes.length > 0) count += 1
  if (filters.loyaltyPrograms.length > 0) count += 1
  if (filters.brands.length > 0) count += 1
  if (filters.services.length > 0) count += 1
  return count
}
