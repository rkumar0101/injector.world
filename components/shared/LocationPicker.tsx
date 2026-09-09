'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export type LocationPickerState = {
  code: string
  name: string
  slug: string
  /** Published clinics behind this option. Rendered on the right of the row when
   *  above zero, so the menu reads "Birmingham   57" the way the city grid does.
   *  Optional: a caller with no count simply renders the name alone. */
  count?: number
}

type Props = {
  states: LocationPickerState[]
  /** URL prefix the picker navigates under, e.g. "/services/botox" or
   * "/brands/juvederm". Kept as a plain string (not a function) because this
   * is a client component and server pages cannot pass functions across the
   * RSC boundary. Final URL: `${basePath}/${state.slug}`. */
  basePath: string
  /** Placeholder on the closed trigger. Defaults to "Select a state"; the brand
   *  state page passes "Select a city", because one level down the same control
   *  lists cities. The `states` prop is really "whatever the next level down
   *  is": `code` is only used as a React key. */
  label?: string
}

/**
 * Location picker, used at two levels. In the brand and service pillar heroes it
 * lists states: pick one, land on that brand's or service's page for it. In the
 * brand state hero it lists that state's cities, with `label="Select a city"`
 * and a `basePath` that already carries the state, so the same
 * `${basePath}/${slug}` produces the city url.
 *
 * Rebuilt 2026-08-07 (client request). It used to be a full-width panel: 50
 * state pill buttons followed by a city search box, which ate most of a screen.
 *
 * Two things were wrong with the dropdown that replaced it, both fixed
 * 2026-09-07:
 *
 * 1. The menu was mounted only while open (`{openMenu === 'state' && ...}`), so
 *    its links never reached the served HTML. A comment here used to claim that
 *    rendering real <Link>s rather than <option>s kept the pillar -> state crawl
 *    path alive; it did not, because a crawler never clicks. The menu now stays
 *    in the DOM and is hidden with CSS, so all 50 state links ship in the HTML.
 *    Closed links carry tabIndex={-1}, so the visual behaviour and the tab order
 *    are unchanged.
 * 2. A state link called `e.preventDefault()` and opened a second, city-level
 *    dropdown instead of navigating. So a crawler could follow the href but a
 *    human could not: clicking a state went nowhere.
 *
 * There used to be a SECOND, dependent dropdown beside this one, listing the
 * cities of whichever state you had selected. It was removed 2026-09-08
 * (founder call): once the state link navigates, nothing sets the selected
 * state, so that control could never leave its "Pick a state first" disabled
 * state, and a permanently dead control is worse than none.
 *
 * The city step came back on 2026-09-10 as a second, INDEPENDENT instance of
 * this same component in the brand state hero, which is a different thing: it
 * depends on nothing, because the state is already in its basePath. Do not
 * reintroduce the dependent version.
 */
export function LocationPicker({ states, basePath, label }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onClickOutside)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const triggerCls =
    'flex w-full items-center justify-between gap-3 rounded-control border border-border bg-surface-canvas px-4 py-2.5 text-body-sm text-ink-primary transition hover:border-brand-accent'
  const menuCls =
    'absolute left-0 right-0 top-full z-30 mt-1.5 max-h-72 overflow-y-auto rounded-control border border-border bg-surface-canvas py-1 shadow-lg'
  const itemCls =
    'flex items-center justify-between gap-3 px-4 py-2 text-body-sm text-ink-secondary transition hover:bg-surface hover:text-brand-accent'
  // The closed menu stays mounted so its links ship in the HTML for crawlers.
  // Zero-size, transparent and click-through, so nothing is visible or in the
  // way; the links inside also get tabIndex={-1} so tabbing skips them.
  const hiddenCls = 'pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0'

  return (
    <div ref={containerRef} className="relative mt-6 sm:max-w-xs">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={triggerCls}
      >
        <span className="text-ink-tertiary">{label ?? 'Select a state'}</span>
        <Chevron open={open} />
      </button>

      <div className={open ? menuCls : hiddenCls} aria-hidden={!open}>
        {states.map((state) => (
          <Link
            key={state.code}
            href={`${basePath}/${state.slug}`}
            tabIndex={open ? undefined : -1}
            onClick={() => setOpen(false)}
            className={itemCls}
          >
            <span>{state.name}</span>
            {state.count != null && state.count > 0 && (
              <span className="text-ink-tertiary">{state.count.toLocaleString()}</span>
            )}
          </Link>
        ))}
      </div>
    </div>
  )
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
      strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 text-ink-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}
