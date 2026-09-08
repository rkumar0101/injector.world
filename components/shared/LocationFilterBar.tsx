'use client'

import { useEffect, useState } from 'react'
import type { StateFilterOption } from '@/lib/location-queries'

type CityOption = { name: string; slug: string; clinicCount: number }

/**
 * State + City dropdown filter, backed by real published-clinic counts (e.g.
 * "Texas (64)"), fetched from the shared lib/location-queries.ts source. Used
 * by both /clinics (ClinicsGrid.tsx) and /search (SearchResultsWithFilters.tsx)
 * so there is one filter, not two parallel implementations.
 *
 * Controlled: the caller owns `selectedState`/`selectedCity` and decides what
 * happens on change (URL navigation on both /clinics and /search) -- this
 * component only renders the dropdowns and fetches the city list for whichever
 * state is selected.
 *
 * `onLocationChange` also receives the matching route slugs when they are
 * known, so a caller that navigates does not have to look them up a second
 * time. `citySlug` is empty when the state changed rather than the city, and
 * either slug can be missing when the selection has no location record behind
 * it, so callers must handle an absent slug.
 */
export function LocationFilterBar({
  stateOptions,
  selectedState,
  selectedCity,
  onLocationChange,
  disabled = false,
}: {
  stateOptions: StateFilterOption[]
  selectedState: string
  selectedCity: string
  onLocationChange: (
    stateCode: string,
    city: string,
    slugs?: { stateSlug: string; citySlug: string },
  ) => void
  disabled?: boolean
}) {
  const [cityOptions, setCityOptions] = useState<CityOption[]>([])
  const [loadingCities, setLoadingCities] = useState(false)

  useEffect(() => {
    if (!selectedState) {
      setCityOptions([])
      return
    }
    const ctrl = new AbortController()
    setLoadingCities(true)
    fetch(`/api/location-filter-options?state=${encodeURIComponent(selectedState)}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => setCityOptions(Array.isArray(data.cities) ? data.cities : []))
      .catch(() => {})
      .finally(() => setLoadingCities(false))
    return () => ctrl.abort()
  }, [selectedState])

  const selectedStateOption = stateOptions.find((s) => s.code === selectedState)
  const selectedStateName = selectedStateOption?.name

  return (
    <>
      <select
        value={selectedState}
        onChange={(e) => {
          const code = e.target.value
          const slug = stateOptions.find((s) => s.code === code)?.slug ?? ''
          onLocationChange(code, '', { stateSlug: slug, citySlug: '' })
        }}
        disabled={disabled}
        className="text-body-sm border border-border rounded-control px-3 py-1.5 bg-surface-canvas text-ink-primary focus:outline-none focus:border-brand-accent disabled:opacity-50"
      >
        <option value="">All states</option>
        {stateOptions.map((s) => (
          <option key={s.code} value={s.code}>
            {s.name} ({s.clinicCount})
          </option>
        ))}
      </select>

      {selectedState && (
        <select
          value={selectedCity}
          onChange={(e) => {
            const city = e.target.value
            const citySlug = cityOptions.find((c) => c.name === city)?.slug ?? ''
            onLocationChange(selectedState, city, {
              stateSlug: selectedStateOption?.slug ?? '',
              citySlug,
            })
          }}
          disabled={disabled || loadingCities || cityOptions.length === 0}
          className="text-body-sm border border-border rounded-control px-3 py-1.5 bg-surface-canvas text-ink-primary focus:outline-none focus:border-brand-accent disabled:opacity-50"
        >
          <option value="">All cities in {selectedStateName}</option>
          {cityOptions.map((c) => (
            <option key={c.name} value={c.name}>
              {c.name} ({c.clinicCount})
            </option>
          ))}
        </select>
      )}
    </>
  )
}
