'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ClinicListItem } from '@/lib/clinic-queries'
import type { MapPin } from '@/components/ui/ListingMapInner'
import { useSaved } from '@/components/account/SavedItemsProvider'
import { LazyMapMount } from '@/components/shared/LazyMapMount'
import { ListingFilters } from '@/components/shared/ListingFilters'
import { DirectoryClinicCard } from '@/components/shared/DirectoryClinicCard'
import { ClinicCardSkeletonGrid } from '@/components/shared/ClinicCardSkeletonGrid'
import { NearMeHeader } from '@/components/shared/NearMeHeader'
import { useNearMe } from '@/components/shared/useNearMe'
import {
  sortClinicsByMeritWithinBuckets,
  NEAR_BUCKET_MILES,
  NEAR_ME_BUCKET_MILES,
} from '@/lib/merit'
import {
  DEFAULT_LISTING_FILTERS,
  applyListingFilters,
  serverFilterKey,
  toServerFilterParams,
  withNearMeDefault,
  type ListingFilterValues,
} from '@/components/shared/applyListingFilters'

const ListingMapInner = dynamic(
  () => import('@/components/ui/ListingMapInner').then((m) => m.ListingMapInner),
  {
    ssr: false,
    loading: () => (
      <div className="w-full rounded-2xl bg-surface border border-border flex items-center justify-center text-ink-tertiary text-body-sm" style={{ height: 480 }}>
        Loading map...
      </div>
    ),
  },
)

type FilterOption = { id: string; name: string }

type Props = {
  initialClinics: ClinicListItem[]
  totalClinics: number
  serviceOptions: FilterOption[]
  brandOptions: FilterOption[]
  loadFailed?: boolean
}

export function ClinicsGrid({
  initialClinics,
  totalClinics,
  serviceOptions,
  brandOptions,
  loadFailed = false,
}: Props) {
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list')
  const [listingFilters, setListingFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)
  const [allClinics, setAllClinics] = useState(initialClinics)
  const [currentTotal, setCurrentTotal] = useState(totalClinics)
  const [selectedState, setSelectedState] = useState('')
  const [selectedCity, setSelectedCity] = useState('')
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Tracks the server-rendered fetch specifically, separate from loadError
  // (which is about client-side load-more/filter requests). A DB-down page
  // load lands here with initialClinics=[] and loadFailed=true; any
  // successful client fetch afterward (a filter change, a retry) clears it,
  // so a legitimately empty filter result doesn't get stuck showing this.
  const [initialLoadFailed, setInitialLoadFailed] = useState(loadFailed)
  const { savedClinics, isSaved, toggle, loggedIn, ready } = useSaved()
  const [activeMapPin, setActiveMapPin] = useState<string | null>(null)

  /**
   * Near-me applies here because /clinics is the one route that renders this
   * grid: /clinics/<state> and /clinics/<state>/<city> use StateHubPage and
   * CityHubPage instead, so the visitor on this page has chosen no location.
   *
   * Asserted rather than assumed. `selectedState` / `selectedCity` are '' on
   * this page today, but if a location scope is ever set here the visitor has
   * made a choice and their IP must not override it -- the same rule the brand
   * and service listings enforce through their state and city slugs.
   */
  const near = useNearMe()
  const nearMeEnabled = !selectedState && !selectedCity
  const effectiveFilters = useMemo(
    () =>
      withNearMeDefault(listingFilters, {
        enabled: nearMeEnabled,
        ready: near.status === 'ready',
        lat: near.lat,
        lng: near.lng,
      }),
    [listingFilters, nearMeEnabled, near.status, near.lat, near.lng],
  )
  const showSkeleton = nearMeEnabled && near.status === 'resolving'

  // Distance band first, merit inside the band (2026-08-15). The server has
  // already ordered the page by band; this settles the order within each one.
  // With no visitor location every clinic shares one band, so the result is the
  // server's own rating-count order, which is what this list showed before.
  //
  // The width must match the one the SQL banded by, or the browser undoes the
  // server's ordering. Both sides derive it from the same test: a radius means
  // the set is already local, so the bands go fine.
  const bucketMiles =
    effectiveFilters.radius != null ? NEAR_ME_BUCKET_MILES : NEAR_BUCKET_MILES
  const bandSorted = useMemo(
    () => sortClinicsByMeritWithinBuckets(allClinics, bucketMiles),
    [allClinics, bucketMiles],
  )
  const listingFiltered = useMemo(
    () => applyListingFilters(bandSorted, effectiveFilters, 'clinic').items,
    [bandSorted, effectiveFilters],
  )

  const hasMore = !showSkeleton && allClinics.length < currentTotal

  async function fetchClinics({
    stateCode,
    city,
    nextPage,
    append,
  }: {
    stateCode: string
    city: string
    nextPage: number
    append: boolean
  }) {
    setIsLoading(true)
    setLoadError(null)
    try {
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: '24',
      })
      if (stateCode) params.set('stateCode', stateCode)
      if (city) params.set('city', city)
      // Brand / service / clinic type / rating are resolved in SQL as of
      // 2026-08-07, so the page that comes back is already filtered and
      // totalDocs is the real match count.
      toServerFilterParams(effectiveFilters).forEach((value, key) => params.set(key, value))

      const res = await fetch(`/api/clinics-list?${params.toString()}`)
      if (!res.ok) throw new Error('Unable to load clinics.')

      const json = await res.json() as { clinics?: ClinicListItem[]; totalDocs?: number }
      const nextClinics = Array.isArray(json.clinics) ? json.clinics : []

      setAllClinics((prev) => append ? [...prev, ...nextClinics] : nextClinics)
      setCurrentTotal(Number(json.totalDocs ?? nextClinics.length))
      setPage(nextPage)
      setInitialLoadFailed(false)
    } catch {
      // Was try/finally with no catch until 2026-08-17, so a failed request left
      // the visitor staring at "Loading..." with nothing else to go on and the
      // rejection unhandled. The brand and service listings already did this.
      setLoadError('Could not load more clinics. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleStateChange(code: string) {
    setSelectedState(code)
    setSelectedCity('')
    setPage(1)
    await fetchClinics({ stateCode: code, city: '', nextPage: 1, append: false })
  }

  // handleCityChange lived here until 2026-09-10. Its only caller was
  // handleLocationChange, which went with the LocationFilterBar: picking a city
  // now means navigating to that city's own page from the hero picker, not
  // filtering this one. `selectedCity` stays because fetchClinics, loadMore and
  // the filter effect all still read it; handleStateChange keeps it at ''.

  async function loadMore() {
    await fetchClinics({
      stateCode: selectedState,
      city: selectedCity,
      nextPage: page + 1,
      append: true,
    })
  }

  // Re-query from page 1 whenever a server-handled filter changes. The ref
  // holds the last key actually fetched, so the first render (already
  // server-rendered, unfiltered) does not trigger a pointless round trip.
  //
  // Seeded with the SERVER-RENDERED listing's key, not the first client key: a
  // returning visitor's saved ZIP resolves before the first render finishes,
  // and seeding with the current key would mark that query as already fetched.
  const serverKey = serverFilterKey(effectiveFilters)
  const appliedServerKey = useRef(serverFilterKey(DEFAULT_LISTING_FILTERS))
  useEffect(() => {
    if (appliedServerKey.current === serverKey) return
    appliedServerKey.current = serverKey
    void fetchClinics({ stateCode: selectedState, city: selectedCity, nextPage: 1, append: false })
    // fetchClinics reads the latest filters and location from the closure it is
    // recreated with each render; only the key drives the refetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey])

  const mapPins: MapPin[] = listingFiltered.map((c) => ({
    id: c.id,
    lat: c.latitude,
    lng: c.longitude,
    title: c.clinicName,
    subtitle: c.neighborhood ? `${c.neighborhood}, ${c.city}` : c.city,
    meta: c.state,
    href: `/clinics/${c.stateSlug}/${c.citySlug}/${c.slug}`,
    rating: c.aggregateRating,
  }))

  return (
    <div className="md:flex md:items-start md:gap-6">
      <ListingFilters
        items={allClinics}
        mode="clinics"
        resultCount={listingFiltered.length}
        totalCount={currentTotal}
        onChange={setListingFilters}
        serviceOptions={serviceOptions}
        brandOptions={brandOptions}
        serverFiltered
      />

      <div className="min-w-0 flex-1 pb-24 md:pb-0">
        {/* Filter bar - view toggle. The state/city selector moved into the
            page hero as a LocationPicker on 2026-09-10; keeping it here too
            would have been two controls doing the same job. */}
        <div className="flex flex-wrap gap-x-4 gap-y-3 items-center mb-5 pb-5 border-b border-border">
          <div className="flex-1" />

          {/* List / Map toggle - unchanged */}
          <div className="flex rounded-control border border-border overflow-hidden flex-shrink-0">
            {(['list', 'map'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-body-sm font-medium transition ${
                  viewMode === mode ? 'bg-brand-primary text-surface-canvas' : 'bg-surface-canvas text-ink-secondary hover:bg-surface'
                }`}
              >
                {mode === 'list' ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polygon points="3 11 22 2 13 21 11 13 3 11" />
                  </svg>
                )}
                {mode === 'list' ? 'List' : 'Map'}
              </button>
            ))}
          </div>
        </div>

        {/* ZIP heading + count + the ZIP changer. Rendered here, on the page
            canvas, never in the navy hero above -- nothing inside that band may
            carry text-ink-*. */}
        <NearMeHeader near={near} enabled={nearMeEnabled} total={currentTotal} />

        {/* Count + saved */}
        <div className="flex items-center justify-between mb-6">
          {/* Held back while the ZIP resolves, for the same reason the cards
              are: a national count that changes a moment later is the flash. */}
          <p className="text-body-sm text-ink-tertiary">
            {showSkeleton ? ' ' : `${listingFiltered.length} ${listingFiltered.length === 1 ? 'clinic' : 'clinics'}`}
          </p>
          {savedClinics.size > 0 && (
            <span className="flex items-center gap-1.5 text-body-sm text-brand-accent">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
              </svg>
              {savedClinics.size} saved
            </span>
          )}
        </div>

        {/* Map */}
        {viewMode === 'map' && (
          <div className="mb-8">
            <LazyMapMount
              placeholder={
                <div className="w-full rounded-2xl bg-surface border border-border flex items-center justify-center text-ink-tertiary text-body-sm" style={{ height: 480 }}>
                  Loading map...
                </div>
              }
            >
              <ListingMapInner
                pins={mapPins}
                activePinId={activeMapPin}
                onPinClick={setActiveMapPin}
                height={480}
              />
            </LazyMapMount>
            <p className="text-caption text-ink-tertiary mt-2 text-center">Click a pin to see the clinic below.</p>
          </div>
        )}

        {/* Grid */}
        {showSkeleton ? (
          // One render, in final form. Without this the national list paints
          // first and is then replaced when geo lands.
          <ClinicCardSkeletonGrid />
        ) : listingFiltered.length === 0 && initialLoadFailed ? (
          <div className="text-center py-20">
            <p className="text-body text-ink-secondary">Couldn&apos;t load clinics right now.</p>
            <p className="text-body-sm text-ink-tertiary mt-1">
              This isn&apos;t an empty directory, something went wrong loading it.
            </p>
            <button
              className="mt-4 text-brand-accent text-body-sm underline"
              onClick={() => fetchClinics({ stateCode: selectedState, city: selectedCity, nextPage: 1, append: false })}
            >
              Try again
            </button>
          </div>
        ) : listingFiltered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-body text-ink-secondary">No clinics match your filter.</p>
            <p className="text-body-sm text-ink-tertiary mt-1">
              Looking for a specific city? <Link href="/states" className="text-brand-accent underline">Browse the full directory by state</Link>.
            </p>
            <button
              className="mt-4 text-brand-accent text-body-sm underline"
              onClick={() => handleStateChange('')}
            >
              Clear filters
            </button>
          </div>
        ) : (() => {
          /* Sign-up gate removed 2026-08-06 (client request): nothing on a
             listing is held back from anonymous visitors any more. The save
             prompt is a separate thing and still stands. */
          return (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
                {listingFiltered.map((c) => (
                  <DirectoryClinicCard
                    key={c.id}
                    c={c}
                    isSaved={isSaved('clinic', c.id)}
                    isHighlighted={activeMapPin === c.id}
                    // Undefined means "not measured", so the card shows no
                    // distance line rather than claiming 0 miles.
                    dist={c.distanceMiles ?? null}
                    onSave={() => toggle('clinic', c.id)}
                  />
                ))}
              </div>
              {loadError && (
                <p className="mt-4 text-center text-body-sm text-state-error" role="status">
                  {loadError}
                </p>
              )}
              {hasMore && !isLoading && (
                <div className="mt-8 text-center">
                  <button
                    onClick={loadMore}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-control border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:bg-surface transition"
                  >
                    {loadError
                      ? 'Try again'
                      : `Load more clinics (${currentTotal - allClinics.length} remaining)`}
                  </button>
                </div>
              )}
              {isLoading && (
                <div className="mt-8 text-center text-body-sm text-ink-tertiary">Loading...</div>
              )}
            </>
          )
        })()}
      </div>
    </div>
  )
}
