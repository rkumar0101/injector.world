'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export type StateOption = {
  name: string
  slug: string
  clinicCount: number
  isLive: boolean
}

/**
 * State picker for /states. Replaced the two full-width grids ("Live now" and
 * "Coming soon", 50-odd tiles between them) on 2026-08-07 (client request).
 *
 * The menu items are real <Link>s rather than <option>s, exactly as in
 * LocationPicker: a native select would have removed every crawlable link to
 * the state pages, and /states is the entry point of the Find path.
 *
 * That alone was not enough. Until 2026-09-07 the menu was mounted only while
 * open, so the links never reached the served HTML and /states led a crawler
 * nowhere. The menu now stays in the DOM and is hidden with CSS, so every state
 * link ships in the HTML. Closed links carry tabIndex={-1}, so the visual
 * behaviour and the tab order are unchanged. The search box still mounts on
 * open, because its autoFocus would otherwise steal focus on page load.
 */
export function StateDropdown({ states }: { states: StateOption[] }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  const filtered = query
    ? states.filter((s) => s.name.toLowerCase().includes(query.toLowerCase()))
    : states

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

  return (
    <div ref={containerRef} className="relative max-w-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 rounded-control border border-border bg-surface-canvas px-4 py-2.5 text-body-sm text-ink-primary transition hover:border-brand-accent"
      >
        <span className="text-ink-tertiary">Select a state</span>
        <svg
          aria-hidden
          width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          className={`shrink-0 text-ink-tertiary transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        className={
          open
            ? 'absolute left-0 right-0 top-full z-30 mt-1.5 max-h-80 overflow-y-auto rounded-control border border-border bg-surface-canvas py-1 shadow-lg'
            : 'pointer-events-none absolute h-0 w-0 overflow-hidden opacity-0'
        }
        aria-hidden={!open}
      >
        {open && (
          <div className="px-3 pb-1.5 pt-1">
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search states"
              className="w-full rounded-control border border-border bg-surface-canvas px-3 py-2 text-body-sm text-ink-primary placeholder:text-ink-tertiary focus:border-brand-accent focus:outline-none"
            />
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="px-4 py-2 text-body-sm text-ink-tertiary">No states match.</p>
        ) : (
          filtered.map((s) => (
            <Link
              key={s.slug}
              href={`/clinics/${s.slug}`}
              tabIndex={open ? undefined : -1}
              onClick={() => setOpen(false)}
              className="flex items-center justify-between gap-3 px-4 py-2 text-body-sm text-ink-secondary transition hover:bg-surface hover:text-brand-accent"
            >
              <span>{s.name}</span>
              {s.isLive ? (
                s.clinicCount > 0 && <span className="text-ink-tertiary">{s.clinicCount.toLocaleString()}</span>
              ) : (
                <span className="text-ink-tertiary">Soon</span>
              )}
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
