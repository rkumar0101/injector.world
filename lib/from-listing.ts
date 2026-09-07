/**
 * Records which listing a visitor left from, for the clinic page breadcrumb.
 * Brand and service listings are remembered; every other path clears the entry
 * so a stale brand context cannot follow the visitor across the site.
 *
 * sessionStorage, deliberately not a `?from=` query param: a param would fork
 * every one of ~57k clinic urls into crawlable variants and burn crawl budget
 * for a same-session convenience. See docs/SEO-PATHS-PLAN-2026-09-07.md.
 */
export const FROM_LISTING_KEY = 'iw:from-listing'

export function rememberListing(pathname: string | null): void {
  if (!pathname) return
  try {
    if (/^\/(brands|services)\//.test(pathname)) {
      sessionStorage.setItem(FROM_LISTING_KEY, pathname)
    } else {
      sessionStorage.removeItem(FROM_LISTING_KEY)
    }
  } catch {
    // Private mode and blocked site data both throw. The breadcrumb falls back
    // to the canonical hierarchy, which is a correct result, not a failure.
  }
}
