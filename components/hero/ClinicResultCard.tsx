'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { rememberListing } from '@/lib/from-listing'

/** A clinic derived from the Hero's matched providers (grouped by clinic). */
export type HeroClinicCard = {
  id: string
  name: string
  slug: string
  citySlug: string
  stateSlug: string
  neighborhood?: string
  city: string
  state: string
  aggregateRating?: number
  aggregateRatingCount?: number
  providerCount: number
  latitude: number
  longitude: number
}

export function ClinicResultCard({ clinic }: { clinic: HeroClinicCard }) {
  const location = [clinic.neighborhood, clinic.city, clinic.state].filter(Boolean).join(', ')
  // Normally `/`, which correctly clears any stored listing. Wired anyway so
  // the rule stays in exactly one place. See lib/from-listing.ts.
  const pathname = usePathname()
  return (
    <Link
      href={`/clinics/${clinic.stateSlug}/${clinic.citySlug}/${clinic.slug}`}
      onClick={() => rememberListing(pathname)}
      className="group flex flex-col gap-2 p-4 rounded-xl border border-border bg-surface-canvas hover:border-brand-accent hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="font-serif text-body font-medium text-ink-primary leading-snug group-hover:text-brand-accent transition-colors">
          {clinic.name}
        </span>
        {clinic.aggregateRating ? (
          <span className="flex items-center gap-1 text-body-sm font-semibold text-ink-primary flex-shrink-0">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#C2A14E" className="flex-shrink-0">
              <path d="M12 2l2.9 6.3 6.9.6-5.2 4.5 1.6 6.7L12 17.3 5.8 20.6l1.6-6.7L2.2 8.9l6.9-.6z" />
            </svg>
            {clinic.aggregateRating.toFixed(1)}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5 text-body-sm text-ink-secondary">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-tertiary flex-shrink-0">
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
        <span className="truncate">{location}</span>
      </div>
      <div className="flex items-center justify-between mt-1">
        {clinic.providerCount > 0 ? (
          <span className="text-caption text-ink-tertiary">
            {clinic.providerCount} verified injector{clinic.providerCount === 1 ? '' : 's'} here
          </span>
        ) : (
          <span />
        )}
        <span className="text-caption font-semibold text-brand-accent inline-flex items-center gap-1">
          View clinic
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
          </svg>
        </span>
      </div>
    </Link>
  )
}
