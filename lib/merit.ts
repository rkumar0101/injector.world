/**
 * Merit ranking v1 — deterministic, explainable, tunable.
 *
 * Adjust MERIT_WEIGHTS and re-deploy to change ranking behaviour.
 * Nothing here makes a DB call; all computation is pure.
 *
 * Score formula (all sub-scores normalised to [0, 1] before weighting):
 *   rating       × w.rating
 *   reviewCount  × w.reviewCount
 *   completeness × w.completeness
 *   recency      × w.recency
 *   responseRate × w.responseRate
 *   minus penalties for unverified license or missing photo
 */
import type { DirectoryProvider, DirectoryClinic } from './location-queries'

// ─── Tunable weights ─────────────────────────────────────────────────────────
// Sensible v1 defaults. The founder can adjust these numbers without touching
// any other code; the sort will automatically reflect the new weights on the
// next ISR revalidation.

export const MERIT_WEIGHTS = {
  /**
   * Patient aggregate rating (0–5, normalised to 0–1).
   * Highest-weight signal: a 5-star provider beats a 2-star provider by 2.0 pts.
   */
  rating: 2.0,

  /**
   * log10(reviewCount + 1) normalised by log10(MAX_REVIEWS + 1).
   * Diminishing returns: 1 review → ~0.08, 10 reviews → ~0.35, 100 → 0.67, 1000 → 1.0.
   * Prevents a single 5-star review from outranking 500 good reviews.
   */
  reviewCount: 1.5,

  /**
   * Fraction of key profile fields populated (photo, bio, startingPrice,
   * treatments listed, languages listed). Max 1.0.
   * Incentivises providers to complete their profile after claiming.
   */
  completeness: 1.0,

  /**
   * Recency: scraped/updated in the last 90 days scores 1.0, fades to 0 at
   * 2 years. Placeholder 0 when updatedAt is unavailable.
   */
  recency: 0.5,

  /**
   * Booking response rate [0–1]. Placeholder 0 until we track bookings.
   */
  responseRate: 0.3,

  penalties: {
    /**
     * Deducted when licenseStateCode or licenseNumber is blank
     * (i.e., the profile has not been verified against the state board).
     */
    unverifiedLicense: 1.5,

    /**
     * Deducted when profilePhotoUrl is blank.
     * A profile without a photo converts poorly and signals an incomplete record.
     */
    noPhoto: 0.5,
  },
} as const

// ─── Internal constants ───────────────────────────────────────────────────────

/** Review counts above this saturate the log score at 1.0. */
const MAX_REVIEWS = 1000

/** Days considered "freshly verified" — recency score = 1.0. */
const RECENCY_FRESH_DAYS = 90

/** Days after which the recency score drops to 0. */
const RECENCY_STALE_DAYS = 730

/**
 * Width of a distance band, in miles, for the IP-located default listing
 * (2026-08-15).
 *
 * The founder's rule: lead with clinics near the visitor, and let merit decide
 * between clinics that are equally near. Sorting on raw distance would rank a
 * mediocre clinic 0.4 miles away above an excellent one 0.9 miles away, which
 * is not what "near me" means at city scale, where both are the same trip. So
 * distance is rounded down into 5-mile bands and merit orders each band.
 *
 * It lives in this module, and not in the SQL layer that also needs it, because
 * this module is pure and safe to pull into a client bundle; the query builder
 * is not. Both sides must use the same number or the bands the server sorted
 * into and the bands the browser re-sorts within would disagree.
 */
export const NEAR_BUCKET_MILES = 5

/**
 * Radius, in miles, for the ZIP-located default listing on the three pillar
 * pages (2026-09-10, founder call). See docs/ZIP-NEAR-ME-LISTING-2026-09-10.md
 *
 * Not the ZIP itself: a single ZIP holds a median of 4 published clinics and
 * ~33,000 of 41,488 US ZIPs hold none, so an exact-ZIP listing would be empty
 * for most visitors. 10 miles around the centroid is 307 clinics in Houston --
 * a full page that still reads as local.
 *
 * 10 is also one of RADIUS_OPTIONS in ListingFilters, so this default and the
 * left-hand radius control agree by construction. Keep it that way.
 */
export const NEAR_ME_RADIUS_MILES = 10

// ─── Extended provider shape ─────────────────────────────────────────────────
// DirectoryProvider has most fields we need. bio and updatedAt are optional
// additions supplied by mapProvider; they gracefully degrade to 0 if absent.

export type MeritProvider = DirectoryProvider & {
  /** Provider bio text (used in completeness score). */
  bio?: string
  /** ISO date string from Payload's updatedAt (used in recency score). */
  updatedAt?: string
}

// ─── Sub-scorers (all return a value in [0, 1]) ───────────────────────────────

function scoreRating(p: MeritProvider): number {
  if (!p.aggregateRating) return 0
  return Math.min(p.aggregateRating, 5) / 5
}

function scoreReviewCount(p: MeritProvider): number {
  const n = p.aggregateRatingCount ?? 0
  return Math.log10(n + 1) / Math.log10(MAX_REVIEWS + 1)
}

function scoreCompleteness(p: MeritProvider): number {
  const checks = [
    !!p.profilePhotoUrl,
    typeof p.bio === 'string' && p.bio.trim().length > 0,
    !!p.startingPrice && p.startingPrice > 0,
    Array.isArray(p.treatments) && p.treatments.length > 0,
    Array.isArray(p.languages) && p.languages.length > 0,
  ]
  return checks.filter(Boolean).length / checks.length
}

function scoreRecency(p: MeritProvider): number {
  if (!p.updatedAt) return 0
  const ageMs = Date.now() - new Date(p.updatedAt).getTime()
  const ageDays = ageMs / (1_000 * 60 * 60 * 24)
  if (ageDays <= RECENCY_FRESH_DAYS) return 1
  if (ageDays >= RECENCY_STALE_DAYS) return 0
  return 1 - (ageDays - RECENCY_FRESH_DAYS) / (RECENCY_STALE_DAYS - RECENCY_FRESH_DAYS)
}

function scoreResponseRate(_p: MeritProvider): number {
  // PLACEHOLDER — always returns 0 until booking-response tracking is implemented.
  // WARNING: when this is wired up, activating it will re-sort ALL provider rankings.
  // Test ranking impact in staging before enabling in production.
  return 0
}

// ─── Main exports ─────────────────────────────────────────────────────────────

/**
 * Returns a merit score >= 0. Higher is better.
 * Pure and deterministic: calling twice with the same input returns the same result.
 */
export function computeMeritScore(p: MeritProvider): number {
  const w = MERIT_WEIGHTS
  let score = 0
  score += scoreRating(p) * w.rating
  score += scoreReviewCount(p) * w.reviewCount
  score += scoreCompleteness(p) * w.completeness
  score += scoreRecency(p) * w.recency
  score += scoreResponseRate(p) * w.responseRate

  // Penalties (subtracted, never below 0)
  const licenseOk = !!p.licenseStateCode && !!p.licenseNumber
  if (!licenseOk) score -= w.penalties.unverifiedLicense
  if (!p.profilePhotoUrl) score -= w.penalties.noPhoto

  return Math.max(score, 0)
}

/** Sort comparator: higher merit score first. */
export function byMeritDesc(a: MeritProvider, b: MeritProvider): number {
  return computeMeritScore(b) - computeMeritScore(a)
}

/**
 * The fields the clinic merit proxy actually reads. Declared separately so the
 * sorts below work on any clinic-shaped row, not just DirectoryClinic: the
 * /clinics listing carries ClinicListItem, which has the same rating and
 * distance fields plus a few of its own.
 */
export type MeritClinicLike = {
  aggregateRating?: number
  aggregateRatingCount?: number
  photoUrl?: string
  startingPrice?: number
  distanceMiles?: number
}

/** The merit proxy used for clinics: rating → review count → completeness. */
function clinicMeritScore(c: MeritClinicLike): number {
  return (
    (c.aggregateRating ?? 0) * 2 +
    Math.log10((c.aggregateRatingCount ?? 0) + 1) +
    (c.photoUrl ? 0.5 : 0) +
    (c.startingPrice ? 0.5 : 0)
  )
}

/** Sort clinics by a simple merit proxy: rating → review count → completeness. */
export function sortClinicsByMerit<T extends MeritClinicLike>(clinics: T[]): T[] {
  return [...clinics].sort((a, b) => clinicMeritScore(b) - clinicMeritScore(a))
}

/**
 * Merit order INSIDE each distance band, bands in order (2026-08-15).
 *
 * Used by the IP-located default listing. The server has already assigned every
 * clinic a 5-mile band and returned them band-first; this keeps those bands
 * intact and only reorders within them. Sorting the loaded page by merit alone
 * would throw the server's distance work away, which is the bug this exists to
 * prevent.
 *
 * A clinic with no distance (outside the near cutoff, or missing coordinates)
 * gets the far band, so the whole "we could not locate this one" group stays
 * together at the end in plain merit order.
 */
export function sortClinicsByMeritWithinBuckets<T extends MeritClinicLike>(
  clinics: T[],
  bucketMiles: number = NEAR_BUCKET_MILES,
): T[] {
  const band = (c: MeritClinicLike): number =>
    typeof c.distanceMiles === 'number' && Number.isFinite(c.distanceMiles)
      ? Math.floor(c.distanceMiles / bucketMiles)
      : Number.MAX_SAFE_INTEGER

  return [...clinics].sort((a, b) => {
    const bandDiff = band(a) - band(b)
    if (bandDiff !== 0) return bandDiff
    return clinicMeritScore(b) - clinicMeritScore(a)
  })
}
