'use client'

import { useState } from 'react'
import { NEAR_ME_RADIUS_MILES } from '@/lib/merit'
import type { NearMeState } from './useNearMe'

/**
 * Heading + count + ZIP changer for the three pillar listings (2026-09-10).
 *
 * Located: `Top Clinics in 77009, Houston, TX`, with the count for that radius.
 * Not located: today's heading, unchanged, plus a "Set your ZIP" control --
 * required, because a visitor whose IP gave nothing (outside the US, VPN, geo
 * over budget) otherwise has no way to reach a local list at all.
 *
 * This renders INSIDE the listing section, on the page canvas, never inside the
 * navy /clinics hero -- so `text-ink-*` is correct here and the always-dark
 * band rule in CLAUDE.md is satisfied by construction rather than by a variant.
 *
 * The page <h1>, the JSON-LD, <title> and the canonical tag are untouched. The
 * server renders `fallbackHeading`; the located heading only ever replaces it
 * after hydration.
 */
export function NearMeHeader({
  near,
  enabled,
  total,
  fallbackHeading,
}: {
  near: NearMeState
  /** False on state and city pages: the visitor already chose a place there. */
  enabled: boolean
  /** Server total for the current query, so the number matches the list. */
  total?: number
  /** The heading this listing shows when no ZIP is in play. */
  fallbackHeading?: string
}) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const located = enabled && near.status === 'ready' && near.zip

  // Nothing to render on a state or city listing that also has no heading of
  // its own to pass down: those pages keep exactly the markup they had.
  if (!enabled && !fallbackHeading) return null

  // "77009, Houston, TX", "77009, Houston" or "77009" -- never ", ,".
  const placeLabel = [near.zip, near.city, near.stateCode].filter(Boolean).join(', ')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setSaving(true)
    setError(null)
    const ok = await near.setZip(draft)
    setSaving(false)
    if (!ok) {
      setError('We could not find that ZIP code.')
      return
    }
    setOpen(false)
    setDraft('')
  }

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        {located ? (
          <h2 className="font-serif text-h2 text-ink-primary">Top Clinics in {placeLabel}</h2>
        ) : fallbackHeading ? (
          <h2 className="font-serif text-h2 text-ink-primary">{fallbackHeading}</h2>
        ) : (
          <span />
        )}

        {enabled && (
          <button
            type="button"
            onClick={() => {
              setOpen((v) => !v)
              setError(null)
            }}
            className="text-body-sm font-medium text-brand-accent hover:underline"
          >
            {located ? 'Change' : 'Set your ZIP'}
          </button>
        )}
      </div>

      {located && typeof total === 'number' && (
        <p className="mt-2 text-body-sm text-ink-secondary">
          {total.toLocaleString()} {total === 1 ? 'clinic' : 'clinics'} within {NEAR_ME_RADIUS_MILES} miles
        </p>
      )}

      {enabled && open && (
        <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="near-me-zip" className="sr-only">
            ZIP code
          </label>
          <input
            id="near-me-zip"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 5))}
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="ZIP code"
            className="w-32 rounded-control border border-border bg-surface-canvas px-3 py-2 text-body-sm text-ink-primary"
          />
          <button
            type="submit"
            disabled={draft.length !== 5 || saving}
            className="rounded-control bg-brand-primary px-4 py-2 text-body-sm font-semibold text-surface-canvas hover:opacity-90 disabled:opacity-50"
          >
            {saving ? 'Checking...' : 'Apply'}
          </button>
          {located && (
            <button
              type="button"
              onClick={() => {
                near.clear()
                setOpen(false)
                setDraft('')
                setError(null)
              }}
              className="text-body-sm text-ink-secondary hover:text-ink-primary"
            >
              Clear
            </button>
          )}
          {error && (
            <p className="w-full text-body-sm text-state-error" role="status">
              {error}
            </p>
          )}
        </form>
      )}
    </div>
  )
}
