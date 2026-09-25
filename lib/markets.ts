// Single source of truth for which markets (states/cities) are live, and for
// the data-quality bar a listing page must clear to enter the indexing queue.
// Read by: homepage Browse-by-State, catch-all router generateMetadata, the
// page-index scan, and the sitemap. Do NOT re-derive either value elsewhere.

/**
 * Every URL family the site publishes. `page_index` holds one row per URL,
 * keyed by `pageKey`, and this union is the row's `pageType`.
 *
 * The first eight are COMPUTED pages: they exist because clinic data exists for
 * a service/brand/location combination, so their quality bar is a clinic count.
 * The rest are ENTITY pages: one URL per document in a collection (or a
 * hardcoded static route), so their bar is just "is the source published".
 */
export const COMPUTED_PAGE_TYPES = [
  'service-pillar', 'service-state', 'service-city',
  'state-hub', 'city-hub',
  'brand-pillar', 'brand-state', 'brand-city-directory',
] as const

// No 'provider' here. The Providers collection, its table, its routes and its
// page_index rows were all removed; leaving the page type behind only put a dead
// option in the admin dropdown. Re-add it the day provider profiles come back --
// and note their url (/injectors/[state]/[city]/[slug]) needs city/state that the
// providers table never carried, so it has to come from the linked clinic.
export const ENTITY_PAGE_TYPES = [
  'clinic', 'guide', 'news', 'static', 'question',
] as const

export const PAGE_TYPES = [...COMPUTED_PAGE_TYPES, ...ENTITY_PAGE_TYPES] as const

export type ComputedPageType = (typeof COMPUTED_PAGE_TYPES)[number]
export type EntityPageType = (typeof ENTITY_PAGE_TYPES)[number]
export type PageType = (typeof PAGE_TYPES)[number]

export function isComputedPageType(t: string): t is ComputedPageType {
  return (COMPUTED_PAGE_TYPES as readonly string[]).includes(t)
}

/**
 * What each page type is called in the admin.
 *
 * The internal names are taxonomy ("service-city", "brand-city-directory",
 * "city-hub") and the admin showed them raw, including one labelled
 * "Service x city (money page)". The founder's first question about the whole
 * screen was what those meant. These are the names a person uses.
 *
 * One source of truth on purpose: the Content screen, the Indexing screen and
 * the URLs list all read from here, so a page type cannot be called three
 * different things in three places.
 */
export const PAGE_TYPE_LABELS: Record<PageType, string> = {
  'service-city': 'Treatment in a city',
  'service-state': 'Treatment in a state',
  'service-pillar': 'Treatment page',
  'brand-city-directory': 'Brand in a city',
  'brand-state': 'Brand in a state',
  'brand-pillar': 'Brand page',
  'city-hub': 'City page',
  'state-hub': 'State page',
  clinic: 'Clinic profile',
  guide: 'Guide',
  news: 'News article',
  static: 'Site page',
  // Value kept as 'question' (an existing enum value) for the /faq/<category>
  // pages that replaced /questions on 2026-09-13. Only the label changed.
  question: 'FAQ page',
}

export function pageTypeLabel(t: string): string {
  return PAGE_TYPE_LABELS[t as PageType] ?? t
}

/**
 * Default minimum published clinics a listing page needs before it shows up in
 * the indexing queue as "ready to batch". Kept as a named export because it is
 * the fallback for any page type missing from INDEX_THRESHOLDS.
 */
export const MIN_CLINICS_TO_INDEX = 5

/**
 * Per-type quality bar, in published clinics.
 *
 * This is a SOFT gate. It decides whether a row is offered up by default in the
 * batch-index tool ("Index next N"), not whether the row is allowed to be
 * indexed. An admin can deliberately batch a below-threshold page. The hard,
 * non-overridable gate is `publishable` (source doc published/approved) --
 * see collections/PageIndex.ts.
 *
 * Rationale for the shape: the deeper the page, the more specific the query it
 * answers, so a thin one still earns its place. Pillars aggregate a whole
 * catalogue, so a thin pillar is a genuinely bad result and needs more behind it.
 *
 * Entity pages carry 1: they are gated by publish/approval status, not volume.
 *
 * These numbers are a starting point and are meant to be tuned. Change them
 * here only -- nothing else should hardcode a threshold.
 */
export const INDEX_THRESHOLDS: Record<PageType, number> = {
  // Computed pages: clinic-count gated.
  'service-city': 5,
  'brand-city-directory': 5,
  // 5, not 3 (2026-09-25): founder rule, a listing page with fewer than 5
  // clinics is never indexed. docs/FIX-ALL-PLAN-2026-09-24.md 5.1.
  'city-hub': 5,
  'service-state': 10,
  'brand-state': 10,
  'state-hub': 10,
  'service-pillar': 25,
  'brand-pillar': 25,
  // Entity pages: publish/approval gated, so the count bar is nominal.
  clinic: 1,
  guide: 1,
  news: 1,
  static: 1,
  question: 1,
}

/** Threshold for a page type, falling back to MIN_CLINICS_TO_INDEX. */
export function thresholdFor(pageType: string): number {
  return INDEX_THRESHOLDS[pageType as PageType] ?? MIN_CLINICS_TO_INDEX
}

type MarketFlags = {
  isLive?: boolean | null
}

/**
 * A market is "live" (shows the real directory, not a Coming Soon placeholder)
 * whenever it has at least one published clinic -- computed automatically by
 * the page-index scan, not a manual admin launch decision.
 *
 * Note this is deliberately NOT the same thing as indexable. Market liveness
 * stayed automatic; indexing became a manual batch decision (2026-08-08).
 */
export function isMarketLive(loc: MarketFlags | null | undefined): boolean {
  return loc?.isLive === true
}

/**
 * Next.js Metadata.robots block for a page that is not (yet) indexed.
 * `follow: true` so crawlers still walk the links onward to indexed pages even
 * though this page itself is not indexed (standard practice for thin pages, and
 * what keeps internal-link discovery working during a slow indexing rollout).
 */
export const NOINDEX_ROBOTS = { index: false, follow: true } as const
