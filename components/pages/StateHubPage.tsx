'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import { ListingFilters } from '@/components/shared/ListingFilters'
import { StateCityCombobox } from '@/components/shared/StateCityCombobox'
import {
  DEFAULT_LISTING_FILTERS,
  applyListingFilters,
  serverFilterKey,
  toServerFilterParams,
  type ListingFilterValues,
} from '@/components/shared/applyListingFilters'
import { sortClinicsByMerit } from '@/lib/merit'
import { CountPill } from '@/components/shared/CountPill'
import { FaqAccordionItem } from '@/components/shared/FaqAccordionItem'
import type { StateHubData } from '@/lib/location-queries'

type Props = { data: StateHubData; schema: object[] }

export function StateHubPage({ data, schema }: Props) {
  const { state, allCities, services: treatments, brands, clinics, faqs, totalClinics } = data
  const [listingFilters, setListingFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)
  const [allClinics, setAllClinics] = useState(clinics)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [serverTotal, setServerTotal] = useState(totalClinics)

  const meritSortedClinics = useMemo(() => sortClinicsByMerit(allClinics), [allClinics])
  const filteredClinics = useMemo(
    () => applyListingFilters(meritSortedClinics, listingFilters, 'clinic').items,
    [meritSortedClinics, listingFilters],
  )
  const hasMore = allClinics.length < serverTotal

  useEffect(() => {
    setAllClinics(clinics)
    setPage(1)
    setLoadError(null)
    setServerTotal(totalClinics)
  }, [clinics, state.slug, totalClinics])

  async function fetchPage(nextPage: number, append: boolean) {
    setIsLoading(true)
    setLoadError(null)

    try {
      const params = new URLSearchParams({
        stateSlug: state.slug,
        page: String(nextPage),
        limit: '24',
      })
      // Brand / service / clinic type / rating are resolved server-side as of
      // 2026-08-07, so totalDocs is the real match count for the filters.
      toServerFilterParams(listingFilters).forEach((value, key) => params.set(key, value))

      const res = await fetch(`/api/state-clinics?${params.toString()}`)
      if (!res.ok) throw new Error('Unable to load more clinics.')

      const json = await res.json() as { clinics?: StateHubData['clinics']; totalDocs?: number }
      const nextClinics = Array.isArray(json.clinics) ? json.clinics : []

      setAllClinics((prev) => {
        if (!append) return nextClinics
        const seen = new Set(prev.map((clinic) => clinic.id))
        return [...prev, ...nextClinics.filter((clinic) => !seen.has(clinic.id))]
      })
      if (typeof json.totalDocs === 'number') setServerTotal(json.totalDocs)
      setPage(nextPage)
    } catch {
      setLoadError('Could not load more clinics. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function loadMore() {
    if (isLoading || !hasMore) return
    await fetchPage(page + 1, true)
  }

  // Re-query from page 1 when a server-handled filter changes. The ref holds
  // the last key actually fetched, so the server-rendered first page is not
  // re-requested on mount.
  const serverKey = serverFilterKey(listingFilters)
  const appliedServerKey = useRef(serverKey)
  useEffect(() => {
    if (appliedServerKey.current === serverKey) return
    appliedServerKey.current = serverKey
    void fetchPage(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey])

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <span className="text-ink-primary">{state.name}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-surface-canvas pt-10 pb-8 border-b border-border">
        <div className="max-canvas">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3 block">
            Clinic Directory
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            Find a verified clinic in {state.name}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-body-lg text-ink-secondary max-w-2xl">
            {totalClinics > 0 && <CountPill count={totalClinics} label="verified clinics" />}
            <span>
              {totalClinics > 0
                ? `in ${state.name}. License-verified, patient-reviewed.`
                : `Browse license-verified Botox and aesthetic clinics across ${state.name}. Real patient reviews.`}
            </span>
          </p>
        </div>
      </section>

      {allCities.length > 0 && (
        <div className="bg-surface border-b border-border">
          <div className="max-canvas py-3 max-w-sm">
            <StateCityCombobox stateSlug={state.slug} stateName={state.name} cities={allCities} />
          </div>
        </div>
      )}

      {/* Service + Brand filter strip */}
      {(treatments.length > 0 || brands.length > 0) && (
        <div className="bg-surface border-b border-border">
          <div className="max-canvas py-3 space-y-2.5">
            {treatments.length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-5 px-5 md:mx-0 md:px-0 md:flex-wrap">
                <span className="flex-shrink-0 text-caption text-ink-tertiary uppercase tracking-wider font-semibold self-center mr-1 hidden md:inline">Services</span>
                {treatments.map((t) => (
                  <Link
                    key={t.id}
                    href={`/services/${t.slug}/${state.slug}`}
                    className="flex-shrink-0 px-4 py-1.5 rounded-control border border-border text-body-sm font-medium text-ink-secondary hover:border-brand-accent hover:text-brand-accent transition"
                  >
                    {t.name}
                  </Link>
                ))}
              </div>
            )}
            {brands.length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-5 px-5 md:mx-0 md:px-0 md:flex-wrap">
                <span className="flex-shrink-0 text-caption text-ink-tertiary uppercase tracking-wider font-semibold self-center mr-1 hidden md:inline">Brands</span>
                {brands.map((b) => (
                  <Link
                    key={b.id}
                    href={`/brands/${b.slug}/${state.slug}`}
                    className="flex-shrink-0 px-4 py-1.5 rounded-control border border-border text-body-sm font-medium text-ink-secondary hover:border-brand-accent hover:text-brand-accent transition"
                  >
                    {b.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas space-y-14">
          <div className="md:flex md:items-start md:gap-6">
            <ListingFilters
              items={allClinics}
              mode="clinics"
              resultCount={filteredClinics.length}
              totalCount={serverTotal}
              onChange={setListingFilters}
              brandOptions={brands.map((b) => ({ id: b.id, name: b.name }))}
              serviceOptions={treatments.map((t) => ({ id: t.id, name: t.name }))}
              serverFiltered
            />

            <div className="min-w-0 flex-1 space-y-14 pb-20 md:pb-0">
              {/* Top Clinics */}
              {filteredClinics.length > 0 ? (
                <div>
                  <h2 className="font-serif text-h2 text-ink-primary mb-6">Top Clinics in {state.name}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                    {filteredClinics.map((c) => (
                      <DirectoryClinicCard key={c.id} c={c} />
                    ))}
                  </div>

                  {loadError && (
                    <p className="mt-4 text-body-sm text-state-error text-center" role="status">
                      {loadError}
                    </p>
                  )}

                  {hasMore && (
                    <div className="mt-6 text-center">
                      <button
                        type="button"
                        onClick={loadMore}
                        disabled={isLoading}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-control border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:bg-surface transition disabled:opacity-50"
                      >
                        {/* serverTotal, not the totalClinics prop: the prop is
                            the unfiltered count fixed at page load, so applying
                            a brand or service filter left this claiming more
                            remaining clinics than the filter can return. */}
                        {isLoading ? 'Loading...' : `Load more clinics (${Math.max(0, serverTotal - allClinics.length)} remaining)`}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-surface p-8 text-center">
                  <p className="text-body text-ink-secondary">No clinics match your filters.</p>
                </div>
              )}
            </div>
          </div>

          {/* Browse by city: full grid.
              StateCityCombobox above is a search box whose options are
              <button>s, so until 2026-09-07 this page had no crawlable link to
              any of its city pages. This grid is that link set, matching the
              pattern already used on BrandStatePage and ServiceStatePage. */}
          {allCities.length > 0 && (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-6">Cities in {state.name}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {allCities.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/${state.slug}/${c.slug}`}
                    className="group flex items-center justify-between p-4 rounded-control border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm transition-all"
                  >
                    <div>
                      <div className="font-medium text-body-sm text-ink-primary group-hover:text-brand-accent transition">{c.name}</div>
                      {c.clinicCount > 0 && <div className="text-caption text-ink-tertiary">{c.clinicCount.toLocaleString()}+ clinics</div>}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-tertiary group-hover:text-brand-accent flex-shrink-0">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* FAQs */}
          {faqs.length > 0 && (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-5">Frequently asked questions</h2>
              <div className="space-y-2 max-w-3xl">
                {faqs.map((f) => (
                  <FaqAccordionItem
                    key={f.id}
                    question={f.question}
                    answer={f.answer}
                    detail={f.detail}
                    offLabel={f.offLabel}
                    safetyFlag={f.safetyFlag}
                    relatedGuideSlug={f.relatedGuideSlug}
                    relatedGuideTitle={f.relatedGuideTitle}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
