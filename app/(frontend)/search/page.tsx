import type { Metadata } from 'next'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { searchDirectory, getSearchFilterOptions } from '@/lib/search-queries'
import { getLocationFilterOptions } from '@/lib/location-queries'
import { getTopResults } from '@/lib/search-content'
import { TopResults } from '@/components/search/TopResults'
import { HeaderSearchBar } from '@/components/header/HeaderSearchBar'
import { SearchMapSection } from '@/components/search/SearchMapSection'
import { SearchResultsWithFilters } from '@/components/search/SearchResultsWithFilters'
import { CountPill } from '@/components/shared/CountPill'

// Results depend on query params and are not indexable, so render on demand.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Search verified injectors and clinics',
  description:
    'Search license-verified Botox and aesthetic injectors and clinics by treatment, location, ZIP, name, or anything in between.',
  robots: { index: false, follow: true },
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; treatment?: string; location?: string; state?: string; city?: string }>
}) {
  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  // Backward-compatible: older links still use treatment/location params.
  const treatment = (sp.treatment ?? '').trim()
  // `location` is what the USER typed (omnibox/hero). `state`/`city` come from
  // the LocationFilterBar dropdown -- kept as separate params so selecting a
  // state doesn't look like "the user typed a location" and hide the bar that
  // just set it (that self-defeating loop was the bug: picking a state made
  // the bar disappear because the code only checked one shared `location`).
  const location = (sp.location ?? '').trim()
  const barState = (sp.state ?? '').trim()
  const barCity = (sp.city ?? '').trim()
  // What actually gets searched: typed location wins, else city (matches by
  // name), else bare state code (searchDirectory already resolves 2-letter
  // codes) -- both existing paths in searchDirectory, no backend change.
  const effectiveLocation = location || barCity || barState
  // The omnibox prefill is the free-text q, or the legacy fields joined.
  const omniValue = q || [treatment, location].filter(Boolean).join(' ')
  const hasQuery = !!(q || treatment || location || barState || barCity)

  // Request a generous page-1 window so the client "Load more" covers the set at
  // current data scale. allowGeocode turns a ZIP / place name into a radius search.
  const [result, topResults, filterOptions, stateOptions] = hasQuery
    ? await Promise.all([
        searchDirectory({ q, treatment, location: effectiveLocation, limit: 100, allowGeocode: true }),
        getTopResults(omniValue),
        getSearchFilterOptions(),
        getLocationFilterOptions(),
      ])
    : [
        {
          clinics: [],
          serviceLabel: undefined as string | undefined,
          locationLabel: undefined as string | undefined,
          clinicTotal: 0,
        },
        [],
        { brandOptions: [], serviceOptions: [] },
        [],
      ]

  const total = result.clinicTotal
  const treatmentText = result.serviceLabel || treatment
  const brandText = result.brandLabel
  const locationText = result.locationLabel || effectiveLocation

  // Build a plain-language summary line (no em dashes).
  let summary = ''
  if (brandText && locationText) summary = `${brandText} injectors in ${locationText}`
  else if (brandText) summary = `${brandText} injectors`
  else if (treatmentText && locationText) summary = `${treatmentText} in ${locationText}`
  else if (treatmentText) summary = treatmentText
  else if (locationText) summary = `Injectors in ${locationText}`
  else if (q) summary = `Results for ${q}`

  return (
    <>
      <Header />

      {/* Search hero */}
      <section className="bg-surface border-b border-border pt-8 pb-8">
        <div className="max-canvas">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-2 block">
            Search
          </span>
          <h1 className="font-serif text-h3 sm:text-h2-m md:text-h2 lg:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-1">
            {hasQuery ? (summary || 'Search results') : 'Find a verified injector'}
          </h1>
          {hasQuery ? (
            <p className="flex flex-wrap items-center gap-2 text-body-sm text-ink-secondary mb-5">
              <CountPill count={total} label={total === 1 ? 'result' : 'results'} />
              <span>across verified clinics.</span>
            </p>
          ) : (
            <p className="text-body-sm text-ink-secondary mb-5">
              Search by treatment, location, ZIP, or name to find verified clinics.
            </p>
          )}
          <HeaderSearchBar defaultQuery={omniValue} className="max-w-2xl" autoFocus={!hasQuery} />
        </div>
      </section>

      {/* Results */}
      <section className="pt-6 md:pt-8 pb-20 md:pb-28 bg-surface-canvas">
        <div className="max-canvas">
          {!hasQuery ? (
            <p className="text-body text-ink-secondary py-8">
              Enter a treatment, location, ZIP, or name above to begin.
            </p>
          ) : (
            <>
              {total === 0 ? (
                topResults.length === 0 ? (
                  <div className="py-12 text-center">
                    <p className="text-body text-ink-primary font-medium mb-2">No matches found</p>
                    <p className="text-body-sm text-ink-secondary max-w-md mx-auto">
                      {/* Copy only (2026-09-25, QA T6-01): this used to name four
                          "launch markets" and call every other state coming soon,
                          while every state has been live since the September
                          directory swap. */}
                      Try a broader treatment, a nearby city, or a ZIP code. We list clinics in
                      every US state.
                    </p>
                  </div>
                ) : (
                  <p className="text-body-sm text-ink-secondary py-4">
                    No clinics matched, but the guides below may help.
                  </p>
                )
              ) : (
                <>
                  <p className="flex flex-wrap items-center gap-2 text-ink-secondary text-sm mb-4">
                    <CountPill count={total} label={total === 1 ? 'result' : 'results'} />
                    {total >= 100 && <span>Refine your search for more.</span>}
                  </p>
                  {locationText && result.clinics.length > 0 && (
                    <SearchMapSection clinics={result.clinics} />
                  )}
                  <SearchResultsWithFilters
                    clinics={result.clinics}
                    brandOptions={filterOptions.brandOptions}
                    serviceOptions={filterOptions.serviceOptions}
                    stateOptions={location ? [] : stateOptions}
                    query={q}
                    initialState={barState}
                    initialCity={barCity}
                  />
                </>
              )}
              {/* Guides / brand hubs sit BELOW the clinic grid: on /search the
                  clinics are the answer, the editorial cards are the follow-up. */}
              <TopResults results={topResults} />
            </>
          )}
        </div>
      </section>

      {/* <PreFooterCta /> removed 2026-08-06 (client request), matching the
          homepage removal of 2026-07-31. The component itself is untouched. */}
      <Footer />
    </>
  )
}
