'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

/**
 * Shown when a signed-out visitor taps Save on a clinic or provider.
 *
 * Saving used to happen silently in localStorage, which read as "it saved"
 * without an account behind it. Now the tap opens this instead, and both
 * buttons carry the current path as ?redirect= so the visitor lands back where
 * they were. Rendered once by SavedItemsProvider, not per card.
 */
export function SaveAuthPrompt({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname()
  const firstActionRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    firstActionRef.current?.focus()
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) return null

  const redirect = encodeURIComponent(pathname || '/')

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="save-auth-title"
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface-canvas p-6 text-center shadow-lg">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-ink-tertiary hover:bg-surface transition"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <span
          aria-hidden
          className="mx-auto mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-brand-accent-soft text-brand-accent"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </span>

        <h2 id="save-auth-title" className="font-serif text-h3 text-ink-primary">
          Save your favorite clinics
        </h2>
        <p className="mt-2 text-body-sm text-ink-secondary">
          Sign in to keep your saved clinics on every device.
        </p>

        <div className="mt-5 flex items-center gap-2.5">
          <Link
            ref={firstActionRef}
            href={`/signup?redirect=${redirect}`}
            className="flex-1 rounded-control bg-brand-primary px-4 py-2.5 text-body-sm font-medium text-surface-canvas hover:opacity-90 transition"
          >
            Sign up
          </Link>
          <Link
            href={`/login?redirect=${redirect}`}
            className="flex-1 rounded-control border border-border px-4 py-2.5 text-body-sm font-medium text-ink-primary hover:bg-surface transition"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
