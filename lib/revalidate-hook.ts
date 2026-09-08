import type { CollectionAfterChangeHook, CollectionAfterDeleteHook } from 'payload'
import { revalidatePath } from 'next/cache'

/**
 * On-demand ISR revalidation hooks.
 *
 * ── The problem this replaced ───────────────────────────────────────────────
 *
 * This module used to call `revalidatePath('/', 'layout')` on every change to
 * any of 11 collections. That invalidates EVERY cached page under the root
 * layout. At ~40k indexable pages, editing one clinic dropped the entire site
 * cache, so every subsequent request became a cache miss against a connection
 * pool capped at 4 (payload.config.ts). A bulk import made it worse: hundreds
 * of full-site invalidations in a single run.
 *
 * ── What it does now ───────────────────────────────────────────────────────
 *
 * Each changed document resolves to the specific paths that actually render
 * it, and only those are revalidated. A clinic edit now touches 5 paths
 * instead of 40,000.
 *
 * ── Why revalidatePath and not revalidateTag ───────────────────────────────
 *
 * `revalidateTag` only invalidates entries in the Data Cache, meaning data
 * wrapped in `unstable_cache` or tagged `fetch` calls. This app's pages are
 * time-based ISR (`export const revalidate = 300`) reading straight from
 * Payload and raw SQL, so there are no tags to invalidate. Tag-based
 * invalidation would require wrapping every query helper in `unstable_cache`,
 * a large refactor with real risk (unstable_cache cannot read request-scoped
 * context such as cookies or headers). Narrowing the path set gets
 * essentially the same win at a fraction of the risk.
 *
 * ── Failure mode is bounded, by design ─────────────────────────────────────
 *
 * If a path mapping is incomplete, the affected page is not invalidated
 * immediately. It still refreshes on its own timer (300s for most pages, 600s
 * for the catch-all). So the worst case of a mapping bug is the behaviour this
 * site had BEFORE on-demand revalidation existed: content appears within five
 * minutes rather than instantly. It is never permanently stale.
 *
 * Anything that cannot be resolved confidently falls through to
 * `revalidateEverything()`, the old global behaviour, so unresolved
 * collections are no worse off than before.
 *
 * ── Rollback ───────────────────────────────────────────────────────────────
 *
 * Set REVALIDATE_STRATEGY=global to restore full-site invalidation without a
 * code change.
 *
 * Attach alongside the audit hooks:
 *   hooks: {
 *     afterChange: [auditAfterChange, revalidateAfterChange],
 *     afterDelete: [auditAfterDelete, revalidateAfterDelete],
 *   }
 */

/** Old behaviour: invalidate the whole public tree. Kept as a safe fallback. */
function revalidateEverything(): void {
  try {
    revalidatePath('/', 'layout')
  } catch {
    // Not inside a Next request (CLI import / seed / set-live scripts run these
    // same hooks). Outside a request scope this is a harmless no-op.
  }
}

function revalidate(paths: string[]): void {
  for (const p of paths) {
    try {
      revalidatePath(p)
    } catch {
      // Same CLI-context no-op as above. One bad path must not stop the rest.
    }
  }
}

/**
 * Resolves the city/state slugs used in URLs from a doc's raw city name and
 * two-letter state code.
 *
 * Imported lazily on purpose: collections/* import this module, and
 * location-slug-lookup reaches payload.config, which imports collections/*.
 * A static import would close that cycle. The underlying lookup is cached for
 * 60s in-process, so this is not a per-edit database round trip.
 */
async function resolveLocationSlugs(
  city: unknown,
  state: unknown,
): Promise<{ citySlug: string; stateSlug: string } | null> {
  if (typeof city !== 'string' || typeof state !== 'string' || !city || !state) return null
  try {
    const { getLocationSlugMap, lookupSlugs } = await import('./location-slug-lookup')
    const map = await getLocationSlugMap()
    const slugs = lookupSlugs(city, state, map)
    if (!slugs.citySlug || !slugs.stateSlug) return null
    return slugs
  } catch {
    return null
  }
}

/**
 * Maps a changed document to the paths that render it.
 *
 * Returns `null` to mean "cannot resolve, fall back to a full invalidation".
 *
 * Note on matrix listing pages (e.g. /brands/juvederm/texas/houston-tx):
 * enumerating every affected combination is not feasible, so only the entity's
 * own page and its index are invalidated. Those matrix pages carry
 * `revalidate = 600` and refresh themselves within ten minutes.
 */
async function pathsFor(collection: string, doc: any, req: any): Promise<string[] | null> {
  const slug = typeof doc?.slug === 'string' && doc.slug ? doc.slug : null

  switch (collection) {
    case 'clinics': {
      if (!slug) return null
      const loc = await resolveLocationSlugs(doc.city, doc.state)
      if (!loc) return null
      return [
        `/clinics/${loc.stateSlug}/${loc.citySlug}/${slug}`,
        `/clinics/${loc.stateSlug}/${loc.citySlug}`,
        `/clinics/${loc.stateSlug}`,
        '/clinics',
        // Homepage surfaces featured / most-reviewed clinics.
        '/',
      ]
    }

    case 'guides':
      return slug ? [`/guides/${slug}`, '/guides', '/'] : ['/guides']

    case 'news':
      // The RSS feed is force-static and must be invalidated explicitly.
      return slug ? [`/news/${slug}`, '/news', '/news/rss.xml', '/'] : ['/news', '/news/rss.xml']

    case 'qa':
      return slug ? [`/questions/${slug}`, '/questions'] : ['/questions']

    case 'brands':
      return slug ? [`/brands/${slug}`, '/brands'] : ['/brands']

    case 'services':
      return slug ? [`/services/${slug}`, '/services'] : ['/services']

    case 'locations':
      // A location's own hub page, plus the state index and the homepage.
      // `/clinics/<slug>` is the state hub. It was `/<slug>` before the paths
      // consolidated under /clinics on 2026-09-09. This has only ever resolved
      // for STATE rows: a city hub needs its parent state slug too, which this
      // doc does not carry, and city rows fall back to their 300s timer.
      return slug ? [`/clinics/${slug}`, '/states', '/'] : ['/states', '/']

    // FAQs render inside other pages (clinic, guide, city hubs) and have no
    // single owning URL. Promotions and reviews likewise fan out across
    // listings and detail pages. Resolving their parents reliably is not worth
    // the risk of serving stale content, and all three are low-frequency
    // edits, so they keep the broad invalidation.
    case 'faqs':
    case 'promotions':
    case 'reviews':
      return null

    default:
      return null
  }
}

async function handle(collection: string, doc: any, req: any): Promise<void> {
  // Bulk operations (scoped wipe, imports) skip per-row revalidation and
  // revalidate once at the end instead, to avoid thousands of calls in a
  // single request.
  if ((req?.context as any)?.disableHooks) return

  if (process.env.REVALIDATE_STRATEGY === 'global') {
    revalidateEverything()
    return
  }

  try {
    const paths = await pathsFor(collection, doc, req)
    if (paths === null) {
      revalidateEverything()
      return
    }
    revalidate(paths)
  } catch (err) {
    // Never let a revalidation problem fail the write that triggered it.
    // Falling back to the broad invalidation keeps content correct.
    console.error(`[revalidate] ${collection} failed, invalidating globally:`, err)
    revalidateEverything()
  }
}

export const revalidateAfterChange: CollectionAfterChangeHook = async ({
  doc,
  req,
  collection,
}) => {
  await handle(collection?.slug ?? '', doc, req)
  return doc
}

export const revalidateAfterDelete: CollectionAfterDeleteHook = async ({
  doc,
  req,
  collection,
}) => {
  await handle(collection?.slug ?? '', doc, req)
  return doc
}
