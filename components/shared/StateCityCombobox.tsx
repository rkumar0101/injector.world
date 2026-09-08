'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { StateCityEntry } from '@/lib/location-queries'

type Props = {
  stateSlug: string
  stateName: string
  cities: StateCityEntry[]
}

export function StateCityCombobox({ stateSlug, stateName, cities }: Props) {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const filteredCities = query
    ? cities.filter((city) => city.name.toLowerCase().includes(query.toLowerCase()))
    : cities

  function selectCity(city: StateCityEntry) {
    setIsOpen(false)
    router.push(`/clinics/${stateSlug}/${city.slug}`)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setIsOpen(true)
      setActiveIndex((i) => Math.min(i + 1, filteredCities.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIndex >= 0 && filteredCities[activeIndex]) {
      e.preventDefault()
      selectCity(filteredCities[activeIndex])
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  useEffect(() => {
    if (activeIndex >= 0 && dropdownRef.current) {
      const el = dropdownRef.current.children[activeIndex] as HTMLElement | undefined
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-tertiary pointer-events-none"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
            setActiveIndex(-1)
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={`Search cities in ${stateName}...`}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          className="w-full pl-10 pr-8 py-3 rounded-sm border border-border bg-surface-canvas text-body text-ink-primary placeholder:text-ink-tertiary focus:outline-none focus:border-brand-accent transition"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setActiveIndex(-1)
            }}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-tertiary hover:text-ink-primary transition"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          role="listbox"
          className="absolute top-full left-0 right-0 mt-1.5 bg-surface-canvas border border-border rounded-lg shadow-lg z-20 overflow-hidden max-h-56 overflow-y-auto"
        >
          {filteredCities.length > 0 ? (
            filteredCities.map((city, i) => (
              <button
                key={city.slug}
                type="button"
                role="option"
                aria-selected={activeIndex === i}
                onMouseDown={(e) => {
                  e.preventDefault()
                  selectCity(city)
                }}
                onMouseEnter={() => setActiveIndex(i)}
                className={[
                  'w-full flex items-center justify-between px-4 py-3 text-left border-b border-border-subtle last:border-0 transition',
                  activeIndex === i ? 'bg-brand-accent-soft' : 'hover:bg-surface',
                ].join(' ')}
              >
                <span className="text-body-sm text-ink-primary font-medium">{city.name}</span>
                <span className="text-caption text-ink-tertiary ml-2 shrink-0">
                  {city.clinicCount}+ clinics
                </span>
              </button>
            ))
          ) : (
            <div className="px-4 py-5 text-center">
              <p className="text-body-sm text-ink-tertiary">
                No cities matching "{query}" in {stateName}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
