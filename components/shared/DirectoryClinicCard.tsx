'use client'

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { DirectoryClinic } from '@/lib/location-queries'
import { useSaved } from '@/components/account/SavedItemsProvider'
import { rememberListing } from '@/lib/from-listing'

export function DirectoryClinicCard({
  c,
  isSaved: isSavedProp,
  isHighlighted = false,
  dist = null,
  onSave: onSaveProp,
  compact = false,
}: {
  c: DirectoryClinic
  isSaved?: boolean
  isHighlighted?: boolean
  dist?: number | null
  onSave?: () => void
  /** Narrow horizontal layout (small square photo + details beside it), for single-column contexts like the AI chat thread. Directory grids never pass this. */
  compact?: boolean
}) {
  const { isSaved: isSavedFromHook, toggle } = useSaved()
  const isSaved = isSavedProp !== undefined ? isSavedProp : isSavedFromHook('clinic', c.id)
  const onSave = onSaveProp ?? (() => toggle('clinic', c.id))
  const stars = Math.round(c.aggregateRating || 0)
  /**
   * Remember which listing the visitor left from, so the clinic page can show a
   * breadcrumb that leads back into the same brand or service path instead of
   * the generic Find path. Leaving a Find-path listing CLEARS the entry rather
   * than skipping the write, so a stale brand context cannot follow the visitor.
   * The rule itself lives in lib/from-listing.ts and is shared with the map
   * popup and the other clinic entry points.
   */
  const pathname = usePathname()

  if (compact) {
    return (
      <article
        className={`group relative bg-surface-canvas rounded-2xl overflow-hidden flex flex-row border transition-all duration-200 hover:shadow-hover ${
          isHighlighted ? 'border-brand-accent shadow-hover' : 'border-border'
        }`}
      >
        {/* Photo */}
        <div className="relative w-[84px] h-[84px] bg-surface overflow-hidden flex-shrink-0">
          {c.photoUrl ? (
            <Image
              src={c.photoUrl}
              alt={c.clinicName}
              fill
              sizes="84px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-brand-accent-soft to-surface" />
          )}
        </div>

        {/* Body */}
        <div className="flex flex-col justify-center flex-1 min-w-0 p-3 gap-1">
          {/* Stretched link: the ::after covers the whole card, so tapping
              anywhere on it opens the clinic. */}
          <h3 className="font-semibold text-body-sm text-ink-primary leading-tight line-clamp-1">
            <Link
              href={`/clinics/${c.stateSlug}/${c.citySlug}/${c.slug}`}
              onClick={() => rememberListing(pathname)}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {c.clinicName}
            </Link>
          </h3>
          <p className="text-caption text-ink-secondary line-clamp-1">
            {c.neighborhood ? `${c.neighborhood}, ` : ''}{c.city}, {c.state}
            {dist !== null && (
              <span className="ml-2 font-medium text-brand-accent">{dist.toFixed(1)} mi</span>
            )}
          </p>

          {c.aggregateRating ? (
            <div className="flex items-center gap-1.5">
              <span className="star-row text-[11px] text-state-star">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
              <span className="text-caption text-ink-secondary">
                {c.aggregateRating.toFixed(1)}
                {c.aggregateRatingCount ? ` (${c.aggregateRatingCount.toLocaleString()})` : ''}
              </span>
            </div>
          ) : null}
        </div>
      </article>
    )
  }

  return (
    <article
      className={`group relative bg-surface-canvas rounded-2xl overflow-hidden flex flex-col border transition-all duration-200 hover:shadow-hover ${
        isHighlighted ? 'border-brand-accent shadow-hover' : 'border-border'
      }`}
    >
      {/* Photo */}
      <div className="relative w-full aspect-[16/9] bg-surface overflow-hidden flex-shrink-0">
        {c.photoUrl ? (
          <Image
            src={c.photoUrl}
            alt={c.clinicName}
            fill
            sizes="(min-width:1024px) 33vw, (min-width:768px) 50vw, 100vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-brand-accent-soft to-surface" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />

        {/* Save button */}
        <button
          onClick={(e) => { e.preventDefault(); onSave() }}
          className={`absolute top-3 right-3 z-10 w-8 h-8 rounded-full flex items-center justify-center shadow-sm transition ${
            isSaved ? 'bg-brand-accent text-white' : 'bg-white/90 text-ink-secondary hover:bg-white'
          }`}
          title={isSaved ? 'Remove from saved' : 'Save clinic'}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill={isSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
          </svg>
        </button>

        {/* The clinic-type badge that used to sit here ("Dermatology",
            "Aesthetic Clinic", "Med Spa") was removed 2026-09-04 on the
            founder's call: clinicType is derived from a scraped Google
            category, so the label was often wrong, and a wrong specialty on a
            medical listing is worse than no specialty at all. */}
      </div>

      {/* Body */}
      <div className="flex flex-col flex-1 p-4 gap-2">
        {/* Name + location */}
        <div>
          {/* Stretched link: the ::after covers the whole card, so tapping
              anywhere on it opens the clinic. The save button sits on z-10 to
              stay its own target. */}
          <h3 className="font-semibold text-body text-ink-primary leading-tight line-clamp-1">
            <Link
              href={`/clinics/${c.stateSlug}/${c.citySlug}/${c.slug}`}
              onClick={() => rememberListing(pathname)}
              className="after:absolute after:inset-0 after:content-['']"
            >
              {c.clinicName}
            </Link>
          </h3>
          <p className="text-caption text-ink-secondary mt-0.5">
            {c.neighborhood ? `${c.neighborhood}, ` : ''}{c.city}, {c.state}
            {dist !== null && (
              <span className="ml-2 font-medium text-brand-accent">{dist.toFixed(1)} mi</span>
            )}
          </p>
        </div>

        {/* Rating */}
        {c.aggregateRating ? (
          <div className="flex items-center gap-1.5">
            <span className="star-row text-[12px] text-state-star">{'★'.repeat(stars)}{'☆'.repeat(5 - stars)}</span>
            <span className="text-caption text-ink-secondary">
              {c.aggregateRating.toFixed(1)}
              {c.aggregateRatingCount ? ` (${c.aggregateRatingCount.toLocaleString()})` : ''}
            </span>
          </div>
        ) : null}

        {/* The footer row (providers count, "from $X", and a "View" link) was
            dropped 2026-08-06 (client request). Only some clinics carry a
            starting price, so the row left half the grid looking empty, and the
            "View" link is redundant now that the whole card is clickable. */}
      </div>
    </article>
  )
}
