'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { rememberListing } from '@/lib/from-listing'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import { ListingFilters } from '@/components/shared/ListingFilters'
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
import type { CityHubData } from '@/lib/location-queries'
import { distinctNeighborhoods, matchesNeighborhood } from '@/lib/neighborhood-filter'

const CLINIC_PAGE_SIZE = 24

type Props = { data: CityHubData; schema: object[] }

export function CityHubPage({ data, schema }: Props) {
  const { city, stateLocation, services: treatments, brands, clinics, neighborhoods, faqs, totalClinics, allClinicLinks } = data
  const cityDisplay = city.name.replace(/\s+city$/i, '')
  const pathname = usePathname()
  const [neighborhood, setNeighborhood] = useState('')
  const [listingFilters, setListingFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)
  const [allClinics, setAllClinics] = useState(clinics)
  const [clinicPage, setClinicPage] = useState(1)
  const [isClinicLoading, setIsClinicLoading] = useState(false)
  const [clinicLoadError, setClinicLoadError] = useState<string | null>(null)
  const [serverTotal, setServerTotal] = useState(totalClinics)

  const meritSortedClinics = useMemo(() => sortClinicsByMerit(allClinics), [allClinics])
  const listingClinics = useMemo(
    () => applyListingFilters(meritSortedClinics, listingFilters, 'clinic').items,
    [meritSortedClinics, listingFilters],
  )
  const filteredClinics = useMemo(
    () => listingClinics.filter((c) => matchesNeighborhood(c.neighborhood, neighborhood)),
    [listingClinics, neighborhood],
  )
  const neighborhoodOptions = useMemo(
    () => distinctNeighborhoods([
      ...neighborhoods.map((n) => n.name),
      ...allClinics.map((c) => c.neighborhood),
    ]),
    [allClinics, neighborhoods],
  )

  useEffect(() => {
    setAllClinics(clinics)
    setClinicPage(1)
    setClinicLoadError(null)
    setServerTotal(totalClinics)
  }, [clinics, city.slug, totalClinics])

  const hasMoreClinics = allClinics.length < serverTotal
  const remainingClinics = Math.max(0, serverTotal - allClinics.length)

  async function fetchClinicPage(nextPage: number, append: boolean) {
    if (!stateLocation) return

    setIsClinicLoading(true)
    setClinicLoadError(null)

    try {
      const params = new URLSearchParams({
        stateSlug: stateLocation.slug,
        citySlug: city.slug,
        page: String(nextPage),
        limit: String(CLINIC_PAGE_SIZE),
      })
      // Brand / service / clinic type / rating are resolved server-side as of
      // 2026-08-07, so totalDocs is the real match count for the filters.
      toServerFilterParams(listingFilters).forEach((value, key) => params.set(key, value))

      const res = await fetch(`/api/city-clinics?${params.toString()}`)
      if (!res.ok) throw new Error('Unable to load more clinics.')

      const json = await res.json() as { clinics?: CityHubData['clinics']; totalDocs?: number }
      const nextClinics = Array.isArray(json.clinics) ? json.clinics : []

      setAllClinics((prev) => {
        if (!append) return nextClinics
        const seen = new Set(prev.map((clinic) => clinic.id))
        return [...prev, ...nextClinics.filter((clinic) => !seen.has(clinic.id))]
      })
      if (typeof json.totalDocs === 'number') setServerTotal(json.totalDocs)
      setClinicPage(nextPage)
    } catch {
      setClinicLoadError('Could not load more clinics. Please try again.')
    } finally {
      setIsClinicLoading(false)
    }
  }

  async function loadMoreClinics() {
    if (isClinicLoading || !hasMoreClinics) return
    await fetchClinicPage(clinicPage + 1, true)
  }

  // Re-query from page 1 when a server-handled filter changes. The ref holds
  // the last key actually fetched, so the server-rendered first page is not
  // re-requested on mount.
  const serverKey = serverFilterKey(listingFilters)
  const appliedServerKey = useRef(serverKey)
  useEffect(() => {
    if (appliedServerKey.current === serverKey) return
    appliedServerKey.current = serverKey
    void fetchClinicPage(1, false)
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
          {/* The Clinics crumb matches the JSON-LD BreadcrumbList this page
              renders, and the url it now sits on. Google expects the markup to
              describe the visible trail, so these two must not drift apart. */}
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary flex-wrap" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <Link href="/clinics" className="hover:text-ink-primary transition">Clinics</Link>
            <span>/</span>
            {stateLocation && (
              <>
                <Link href={`/clinics/${stateLocation.slug}`} className="hover:text-ink-primary transition">{stateLocation.name}</Link>
                <span>/</span>
              </>
            )}
            <span className="text-ink-primary">{city.name}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-surface-canvas pt-10 pb-8 border-b border-border">
        <div className="max-canvas">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3 block">
            {stateLocation?.name ?? city.stateCode}
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            Find clinics in {cityDisplay}
          </h1>
          <p className="flex flex-wrap items-center gap-2 text-body-lg text-ink-secondary max-w-2xl">
            {totalClinics > 0 && <CountPill count={totalClinics} label="verified aesthetic clinics" />}
            <span>
              {totalClinics > 0
                ? `in ${cityDisplay}. Choose a service or browse all below.`
                : `Browse verified aesthetic clinics in ${cityDisplay}. Choose a service to get started.`}
            </span>
          </p>
        </div>
      </section>

      {/* Service + Brand picker chips */}
      {(treatments.length > 0 || brands.length > 0) && (
        <div className="bg-surface border-b border-border">
          <div className="max-canvas py-3 space-y-2.5">
            {treatments.length > 0 && (
              <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-5 px-5 md:mx-0 md:px-0 md:flex-wrap">
                <span className="flex-shrink-0 text-caption text-ink-tertiary uppercase tracking-wider font-semibold self-center mr-1 hidden md:inline">Services</span>
                {treatments.map((t) => (
                  <Link
                    key={t.id}
                    href={stateLocation ? `/services/${t.slug}/${stateLocation.slug}/${city.slug}` : `/services/${t.slug}`}
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
                    href={stateLocation ? `/brands/${b.slug}/${stateLocation.slug}/${city.slug}` : `/brands/${b.slug}`}
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
              {neighborhoodOptions.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-caption text-ink-tertiary uppercase tracking-wider">Neighborhood</span>
                  <select
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    className="px-3 py-2 rounded-control border border-border text-body-sm text-ink-primary bg-surface-canvas focus:outline-none focus:border-brand-accent cursor-pointer"
                    aria-label="Filter by neighborhood"
                  >
                    <option value="">All neighborhoods</option>
                    {neighborhoodOptions.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Top Clinics */}
              {filteredClinics.length > 0 ? (
                <div>
                  <div className="flex items-baseline justify-between mb-6">
                    <h2 className="font-serif text-h2 text-ink-primary">Top clinics in {cityDisplay}</h2>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredClinics.map((c) => (
                      <DirectoryClinicCard key={c.id} c={c} />
                    ))}
                  </div>
                  {clinicLoadError && (
                    <p className="mt-4 text-body-sm text-state-error text-center" role="status">
                      {clinicLoadError}
                    </p>
                  )}
                  {hasMoreClinics && (
                    <div className="mt-6 text-center">
                      <button
                        type="button"
                        onClick={loadMoreClinics}
                        disabled={isClinicLoading}
                        className="inline-flex items-center gap-2 px-6 py-3 rounded-control border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:bg-surface transition disabled:opacity-50"
                      >
                        {isClinicLoading ? 'Loading...' : `Load more clinics (${remainingClinics} remaining)`}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-surface p-8 text-center">
                  <p className="text-body text-ink-secondary">No clinics match your filters.</p>
                  <button
                    type="button"
                    onClick={() => setNeighborhood('')}
                    className="mt-3 text-brand-accent text-body-sm hover:underline"
                  >
                    Clear neighborhood
                  </button>
                </div>
              )}
            </div>
          </div>

          {/*
            Full clinic link index.

            The card grid above stops at 24 rows behind a JS "Load more", so
            every clinic past that point was unreachable by a crawler. This list
            carries the rest. It is rendered unconditionally, never behind an
            accordion or an open state: markup that is not in the served HTML
            does nothing for discovery. Plain text links on purpose, no cards
            and no per-row SVG, which is what keeps 450 rows cheap.
          */}
          {stateLocation && allClinicLinks.length > 1 && (
            <div>
              <h2 className="font-serif text-h3 text-ink-primary mb-5">
                All clinics in {cityDisplay}, {city.stateCode}
              </h2>
              <ul className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2">
                {allClinicLinks.map((c) => (
                  <li key={c.slug}>
                    <Link
                      href={`/clinics/${stateLocation.slug}/${city.slug}/${c.slug}`}
                      onClick={() => rememberListing(pathname)}
                      className="text-body-sm text-ink-secondary hover:text-brand-accent transition"
                    >
                      {c.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* State link */}
          {stateLocation && (
            <div className="rounded-2xl border border-border bg-surface p-6">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <div className="font-semibold text-body text-ink-primary">All clinics in {stateLocation.name}</div>
                  <div className="text-body-sm text-ink-secondary mt-0.5">Compare cities and services statewide.</div>
                </div>
                <Link href={`/clinics/${stateLocation.slug}`} className="flex items-center gap-1.5 text-body-sm text-brand-accent font-medium hover:underline flex-shrink-0">
                  Browse {stateLocation.name}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                </Link>
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
