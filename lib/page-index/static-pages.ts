/**
 * Every hand-written route on the site, in one list.
 *
 * Single source of truth, read by BOTH the page scan (which creates a
 * `page_index` row per entry so static routes are controllable like any other
 * url) and the sitemap's `pages` child. Previously the sitemap held this list
 * privately, which meant static routes had no admin representation at all --
 * they could not be seen, filtered, or held back during a slow rollout.
 *
 * `indexable: false` means there is nothing here worth a search result, ever.
 * The scan writes those rows with `publishable = false`, which is the hard gate,
 * so no batch can accidentally index them. Two reasons a route lands there:
 *   - it is an app surface, not content (login, dashboard, checkout-ish flows)
 *   - it is a results/placeholder page (internal search, a directory awaiting data)
 * They still get a row so the registry can honestly claim to cover every url.
 *
 * Keep in sync with app/(frontend)/**. A route missing here is invisible to the
 * indexing controls.
 */

export type StaticPage = {
  path: string
  changefreq: 'daily' | 'weekly' | 'monthly' | 'yearly'
  priority: number
  indexable: boolean
  /** Why it is not indexable. Surfaced in the admin so the reason is not folklore. */
  note?: string
}

export const STATIC_PAGES: StaticPage[] = [
  // ── Content and directory entry points ─────────────────────────────────────
  { path: '/', changefreq: 'daily', priority: 1.0, indexable: true },
  { path: '/clinics', changefreq: 'daily', priority: 0.9, indexable: true },
  { path: '/states', changefreq: 'weekly', priority: 0.8, indexable: true },
  { path: '/services', changefreq: 'weekly', priority: 0.9, indexable: true },
  { path: '/brands', changefreq: 'weekly', priority: 0.9, indexable: true },
  { path: '/guides', changefreq: 'weekly', priority: 0.8, indexable: true },
  { path: '/news', changefreq: 'daily', priority: 0.8, indexable: true },
  // /videos and /patient-stories were deleted 2026-09-04, and /questions went on
  // 2026-09-13 when FAQs replaced Q&A. /faq is its replacement; the category
  // pages under it (/faq/<slug>) are registered by the scan as page type
  // 'question'. See docs/FAQ-SYSTEM-2026-09-13.md.
  { path: '/faq', changefreq: 'weekly', priority: 0.7, indexable: true },
  // NOTE: no /treatments entry. app/(frontend)/treatments/ holds only an empty
  // [area]/ directory with no page.tsx, so both /treatments and /treatments/*
  // currently 404. Add it here the day that route ships.

  // ── Trust and company ──────────────────────────────────────────────────────
  { path: '/how-we-verify', changefreq: 'monthly', priority: 0.6, indexable: true },
  { path: '/editorial-standards', changefreq: 'monthly', priority: 0.5, indexable: true },
  { path: '/about', changefreq: 'monthly', priority: 0.5, indexable: true },
  { path: '/press', changefreq: 'monthly', priority: 0.4, indexable: true },
  { path: '/careers', changefreq: 'monthly', priority: 0.4, indexable: true },
  { path: '/contact', changefreq: 'monthly', priority: 0.4, indexable: true },

  // ── Clinic acquisition ─────────────────────────────────────────────────────
  { path: '/list-your-clinic', changefreq: 'monthly', priority: 0.7, indexable: true },
  { path: '/pricing', changefreq: 'monthly', priority: 0.6, indexable: true },

  // ── Legal ──────────────────────────────────────────────────────────────────
  { path: '/privacy', changefreq: 'yearly', priority: 0.3, indexable: true },
  { path: '/terms', changefreq: 'yearly', priority: 0.3, indexable: true },
  { path: '/hipaa', changefreq: 'yearly', priority: 0.3, indexable: true },

  // ── Never indexable: results and placeholder pages ─────────────────────────
  {
    path: '/search',
    changefreq: 'daily', priority: 0, indexable: false,
    note: 'Internal search results. Kept out of search on principle, not because of thin data.',
  },

  // ── Never indexable: app surfaces ──────────────────────────────────────────
  // Listed so the registry genuinely covers every url rather than quietly
  // omitting a couple of dozen. All hardcode robots: noindex in their own
  // metadata too, so this is belt and braces.
  { path: '/login', changefreq: 'yearly', priority: 0, indexable: false, note: 'Auth surface.' },
  { path: '/register', changefreq: 'yearly', priority: 0, indexable: false, note: 'Auth surface.' },
  { path: '/signup', changefreq: 'yearly', priority: 0, indexable: false, note: 'Auth surface.' },
  { path: '/forgot-password', changefreq: 'yearly', priority: 0, indexable: false, note: 'Auth surface.' },
  { path: '/reset-password', changefreq: 'yearly', priority: 0, indexable: false, note: 'Auth surface.' },
  { path: '/verify-email', changefreq: 'yearly', priority: 0, indexable: false, note: 'Auth surface.' },
  { path: '/setup-account', changefreq: 'yearly', priority: 0, indexable: false, note: 'Auth surface.' },
  { path: '/profile', changefreq: 'yearly', priority: 0, indexable: false, note: 'Signed-in surface.' },
  { path: '/dashboard', changefreq: 'yearly', priority: 0, indexable: false, note: 'Signed-in surface.' },
  { path: '/dashboard/clinic', changefreq: 'yearly', priority: 0, indexable: false, note: 'Signed-in surface.' },
  { path: '/dashboard/brand', changefreq: 'yearly', priority: 0, indexable: false, note: 'Signed-in surface.' },
  { path: '/claim', changefreq: 'yearly', priority: 0, indexable: false, note: 'Claim flow.' },
  { path: '/newsletter/confirmed', changefreq: 'yearly', priority: 0, indexable: false, note: 'Transactional confirmation.' },
  { path: '/newsletter/unsubscribed', changefreq: 'yearly', priority: 0, indexable: false, note: 'Transactional confirmation.' },
]

/** The subset the sitemap may emit, once each row is actually batched in. */
export const INDEXABLE_STATIC_PAGES = STATIC_PAGES.filter((p) => p.indexable)

const BY_PATH = new Map(STATIC_PAGES.map((p) => [p.path, p]))

export function staticPageFor(path: string): StaticPage | undefined {
  return BY_PATH.get(path)
}
