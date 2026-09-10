'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import Link from 'next/link'
import { ListingFilters } from './ListingFilters'
import { DirectoryClinicCard } from './DirectoryClinicCard'
import { ClinicCardSkeletonGrid } from './ClinicCardSkeletonGrid'
import { NearMeHeader } from './NearMeHeader'
import { useNearMe } from './useNearMe'
import {
  DEFAULT_LISTING_FILTERS,
  applyListingFilters,
  serverFilterKey,
  toServerFilterParams,
  withNearMeDefault,
  type ListingFilterValues,
} from './applyListingFilters'
import {
  sortClinicsByMeritWithinBuckets,
  NEAR_BUCKET_MILES,
  NEAR_ME_BUCKET_MILES,
} from '@/lib/merit'
import type { DirectoryClinic } from '@/lib/location-queries'

type FilterOption = { id: string; name: string }

type Props = {
  clinics: DirectoryClinic[]
  serviceOptions?: FilterOption[]
  brandOptions?: FilterOption[]
  emptyMessage?: string
  emptyLink?: { href: string; label: string }
  brandSlug?: string
  stateSlug?: string
  citySlug?: string
  totalClinics?: number
  /** Heading for the listing when no ZIP is in play. Pillar page only. */
  listingHeading?: string
}

export function BrandDirectoryListing({
  clinics,
  serviceOptions,
  brandOptions,
  emptyMessage,
  emptyLink,
  brandSlug,
  stateSlug,
  citySlug,
  totalClinics,
  listingHeading,
}: Props) {
  const [displayedClinics, setDisplayedClinics] = useState<DirectoryClinic[]>(clinics)
  const [listingFilters, setListingFilters] = useState<ListingFilterValues>(DEFAULT_LISTING_FILTERS)
  const [currentPage, setCurrentPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [serverTotal, setServerTotal] = useState<number | undefined>(totalClinics)

  /**
   * Near-me applies only where the visitor has chosen no location, i.e. the
   * brand PILLAR page. On /brands/<brand>/<state> and .../<city> they have
   * already chosen one and overriding it with their IP would be wrong.
   *
   * The test is the absence of both slugs rather than a new boolean prop, so it
   * is structurally impossible to leak onto a state or city page: those routes
   * cannot render this component without passing them.
   */
  const near = useNearMe()
  const nearMeEnabled = !stateSlug && !citySlug
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

  useEffect(() => {
    setDisplayedClinics(clinics)
    setCurrentPage(1)
    setLoadError(null)
    setServerTotal(totalClinics)
  }, [clinics, brandSlug, stateSlug, citySlug, totalClinics])

  // Distance band first, merit inside the band. When the visitor could not be
  // located, every clinic has no distance, every clinic lands in the same band,
  // and this degrades to exactly the plain merit sort it replaced.
  //
  // The band width must match the one the SQL banded by, or the two disagree and
  // the browser undoes the server's ordering. Both derive it from the same test:
  // a radius means the set is already local, so the bands go fine.
  const bucketMiles =
    effectiveFilters.radius != null ? NEAR_ME_BUCKET_MILES : NEAR_BUCKET_MILES
  const meritSortedClinics = useMemo(
    () => sortClinicsByMeritWithinBuckets(displayedClinics, bucketMiles),
    [displayedClinics, bucketMiles],
  )
  const filtered = useMemo(
    () => applyListingFilters(meritSortedClinics, effectiveFilters, 'clinic').items,
    [meritSortedClinics, effectiveFilters],
  )

  const showLoadMore = Boolean(
    !showSkeleton && brandSlug && serverTotal && displayedClinics.length < serverTotal,
  )

  async function fetchPage(nextPage: number, append: boolean) {
    if (!brandSlug) return
    setIsLoading(true)
    setLoadError(null)

    try {
      const params = new URLSearchParams({
        brandSlug,
        page: String(nextPage),
        limit: '24',
      })
      if (stateSlug) params.set('stateSlug', stateSlug)
      if (citySlug) params.set('citySlug', citySlug)
      // Brand / service / clinic type / rating are resolved server-side as of
      // 2026-08-07, so totalDocs is the real match count for the filters.
      toServerFilterParams(effectiveFilters).forEach((value, key) => params.set(key, value))

      const res = await fetch(`/api/brand-clinics?${params.toString()}`)
      if (!res.ok) throw new Error('Unable to load more clinics.')
      const data = await res.json() as { clinics?: DirectoryClinic[]; totalDocs?: number }
      const nextClinics = Array.isArray(data.clinics) ? data.clinics : []

      setDisplayedClinics((prev) => {
        if (!append) return nextClinics
        const seen = new Set(prev.map((clinic) => clinic.id))
        return [...prev, ...nextClinics.filter((clinic) => !seen.has(clinic.id))]
      })
      if (typeof data.totalDocs === 'number') setServerTotal(data.totalDocs)
      setCurrentPage(nextPage)
    } catch {
      setLoadError('Could not load more clinics. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleLoadMore() {
    if (isLoading) return
    await fetchPage(currentPage + 1, true)
  }

  // Re-query from page 1 when a server-handled filter changes. The ref holds
  // the last key actually fetched, so the server-rendered first page is not
  // re-requested on mount.
  //
  // Seeded with the key of the SERVER-RENDERED listing (no filters, no
  // near-me), not with the first client key. A returning visitor resolves their
  // saved ZIP before the first render finishes, so seeding with the current key
  // would record the ZIP query as already fetched and leave the national list
  // on screen under a local heading.
  const serverKey = serverFilterKey(effectiveFilters)
  const appliedServerKey = useRef(serverFilterKey(DEFAULT_LISTING_FILTERS))
  useEffect(() => {
    if (appliedServerKey.current === serverKey) return
    appliedServerKey.current = serverKey
    void fetchPage(1, false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverKey])

  return (
    <div className="md:flex md:items-start md:gap-6">
      <ListingFilters
        items={displayedClinics}
        mode="clinics"
        resultCount={filtered.length}
        totalCount={serverTotal ?? displayedClinics.length}
        onChange={setListingFilters}
        serviceOptions={serviceOptions}
        brandOptions={brandOptions}
        // Only the brand routes have a server endpoint to re-query.
        serverFiltered={Boolean(brandSlug)}
      />

      <div className="min-w-0 flex-1">
        <NearMeHeader
          near={near}
          enabled={nearMeEnabled}
          total={serverTotal}
          fallbackHeading={listingHeading}
        />

        {showSkeleton ? (
          // The list appears once, in its final form, instead of appearing
          // national and then being replaced when geo lands.
          <ClinicCardSkeletonGrid />
        ) : filtered.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {filtered.map((c) => (
              // Distance is what makes a near-me list readable: without it the
              // order looks arbitrary even when it is correct. Undefined means
              // "not measured", so the card shows no distance line rather than
              // claiming 0 miles.
              <DirectoryClinicCard key={c.id} c={c} dist={c.distanceMiles ?? null} />
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <p className="text-body text-ink-secondary mb-3">
              {emptyMessage ?? 'No clinics match the selected filters.'}
            </p>
            {emptyLink && (
              <Link href={emptyLink.href} className="text-brand-accent hover:underline text-body-sm">
                {emptyLink.label}
              </Link>
            )}
          </div>
        )}

        {loadError && (
          <p className="mt-4 text-body-sm text-state-error" role="status">
            {loadError}
          </p>
        )}

        {showLoadMore && (
          <div className="mt-8 flex justify-center">
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={isLoading}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-control border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:bg-surface transition disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : `Load more clinics (${Math.max(0, (serverTotal ?? 0) - displayedClinics.length)} remaining)`}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
