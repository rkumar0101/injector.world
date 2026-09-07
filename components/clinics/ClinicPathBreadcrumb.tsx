'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { FROM_LISTING_KEY } from '@/lib/from-listing'

type Props = {
  stateSlug: string
  stateName: string
  citySlug: string
  cityName: string
  clinicName: string
}

/**
 * Only these shapes are accepted out of storage: `/brands/<slug>`,
 * `/brands/<slug>/<state>`, `/brands/<slug>/<state>/<city>` and the
 * `/services/...` equivalents. No protocol, no `//`, no `..`, no query string,
 * no uppercase. Anything else is ignored and the canonical breadcrumb stands.
 */
const FROM_PATTERN = /^\/(brands|services)\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*){0,2}$/

function titleFromSlug(slug: string): string {
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

/**
 * City slugs carry a trailing state code (`houston-tx`, `new-york-ny`), which
 * must not show up in the label.
 */
function cityLabelFromSlug(slug: string): string {
  return titleFromSlug(slug.replace(/-[a-z]{2}$/, ''))
}

/**
 * Renders the canonical breadcrumb on the server pass, then upgrades to a
 * path-aware one after hydration when the visitor arrived from a brand or
 * service listing. The stored path comes from sessionStorage, deliberately not
 * a `?from=` query param: a param would fork every one of ~57k clinic urls into
 * crawlable variants and burn crawl budget for a same-session convenience.
 * See docs/SEO-PATHS-PLAN-2026-09-07.md.
 *
 * The JSON-LD BreadcrumbList on this page is untouched by any of this. Google
 * always sees the one stable Home / Clinics / State / City / Clinic hierarchy.
 */
export function ClinicPathBreadcrumb({
  stateSlug,
  stateName,
  citySlug,
  cityName,
  clinicName,
}: Props) {
  const [from, setFrom] = useState<string | null>(null)

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(FROM_LISTING_KEY)
      if (stored && FROM_PATTERN.test(stored)) setFrom(stored)
    } catch {
      // Private mode and blocked site data both throw. The breadcrumb falls
      // back to the canonical hierarchy, which is a correct result, not a
      // failure.
    }
  }, [])

  if (!from) {
    return (
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex min-w-0 items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <Link href="/clinics" className="hover:text-ink-primary transition">Clinics</Link>
            <span>/</span>
            <Link href={`/${stateSlug}`} className="hover:text-ink-primary transition">
              {stateName}
            </Link>
            <span>/</span>
            <Link href={`/${stateSlug}/${citySlug}`} className="hover:text-ink-primary transition">
              {cityName}
            </Link>
            <span>/</span>
            <span className="truncate text-ink-primary">{clinicName}</span>
          </nav>
        </div>
      </div>
    )
  }

  const [root, entitySlug, fromStateSlug, fromCitySlug] = from.slice(1).split('/')
  const rootLabel = root === 'brands' ? 'Brands' : 'Services'
  const entityLabel = titleFromSlug(entitySlug)
  const stateLabel = fromStateSlug ? titleFromSlug(fromStateSlug) : null
  const cityLabel = fromCitySlug
    ? fromCitySlug === citySlug
      ? cityName
      : cityLabelFromSlug(fromCitySlug)
    : null

  const backLabel = cityLabel
    ? `Back to ${entityLabel} in ${cityLabel}`
    : stateLabel
      ? `Back to ${entityLabel} in ${stateLabel}`
      : `Back to ${entityLabel}`

  return (
    <div className="bg-surface border-b border-border">
      <div className="max-canvas py-3">
        <nav className="flex min-w-0 flex-wrap items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-ink-primary transition">Home</Link>
          <span>/</span>
          <Link href={`/${root}`} className="hover:text-ink-primary transition">{rootLabel}</Link>
          <span>/</span>
          <Link href={`/${root}/${entitySlug}`} className="hover:text-ink-primary transition">
            {entityLabel}
          </Link>
          {stateLabel && (
            <>
              <span>/</span>
              <Link href={`/${root}/${entitySlug}/${fromStateSlug}`} className="hover:text-ink-primary transition">
                {stateLabel}
              </Link>
            </>
          )}
          {cityLabel && (
            <>
              <span>/</span>
              <Link href={from} className="hover:text-ink-primary transition">
                {cityLabel}
              </Link>
            </>
          )}
          <span>/</span>
          <span className="truncate text-ink-primary">{clinicName}</span>
        </nav>
        <Link href={from} className="mt-1 inline-block text-body-sm text-brand-accent hover:underline">
          {backLabel}
        </Link>
      </div>
    </div>
  )
}
