/**
 * Records which listing a visitor left from, for the clinic page breadcrumb.
 * Brand and service listings are remembered; every other path clears the entry
 * so a stale brand context cannot follow the visitor across the site.
 *
 * sessionStorage, deliberately not a `?from=` query param: a param would fork
 * every one of ~57k clinic urls into crawlable variants and burn crawl budget
 * for a same-session convenience. See docs/SEO-PATHS-PLAN-2026-09-07.md.
 *
 * Tied to the clicked clinic (2026-09-25, QA T4-02). The entry used to be the
 * listing path alone, which then applied to EVERY clinic opened later in the
 * tab: an Ohio clinic reached from search showed "Home / Brands / Botox /
 * Texas / Houston". It now stores the clinic url that was clicked, and the
 * breadcrumb uses the listing only on that clinic's page. An entry in the old
 * plain-string shape (a tab open across the deploy) is ignored, which falls
 * back to the canonical trail.
 */
export const FROM_LISTING_KEY = 'iw:from-listing'

type Stored = { from: string; clinic: string }

export function rememberListing(pathname: string | null, clinicHref?: string): void {
  if (!pathname) return
  try {
    if (/^\/(brands|services)\//.test(pathname) && clinicHref) {
      const entry: Stored = { from: pathname, clinic: clinicHref.split(/[?#]/)[0] }
      sessionStorage.setItem(FROM_LISTING_KEY, JSON.stringify(entry))
    } else {
      sessionStorage.removeItem(FROM_LISTING_KEY)
    }
  } catch {
    // Private mode and blocked site data both throw. The breadcrumb falls back
    // to the canonical hierarchy, which is a correct result, not a failure.
  }
}

/** The listing the visitor came from, but only if it was THIS clinic they clicked. */
export function readListingFor(clinicPath: string): string | null {
  try {
    const raw = sessionStorage.getItem(FROM_LISTING_KEY)
    if (!raw || raw[0] !== '{') return null
    const entry = JSON.parse(raw) as Partial<Stored>
    if (typeof entry.from !== 'string' || typeof entry.clinic !== 'string') return null
    return entry.clinic === clinicPath ? entry.from : null
  } catch {
    return null
  }
}
