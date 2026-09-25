'use client'

import Image from 'next/image'
import { useCallback, useRef, useState } from 'react'

/** Client cap (2026-08-10). Anything past the eighth photo is not reachable. */
const MAX_PHOTOS = 8

/**
 * Clinic hero gallery.
 *
 * Was a single static cover image between 2026-08-06 and 2026-08-10. It browses
 * again now (client request), but the two breakpoints browse differently:
 *
 *   desktop  one large frame, a scrollable thumbnail strip underneath, and an
 *            arrow at each end of the strip. Clicking a thumbnail swaps the
 *            frame. No arrows on the frame itself.
 *   mobile   no strip. An arrow on each side of the frame, dots underneath
 *            marking the active photo, and horizontal swipe.
 *
 * The empty state has carried through every version of this component unchanged.
 */
export function ClinicCoverPhoto({
  clinicName,
  photoUrls,
}: {
  clinicName: string
  photoUrls: string[]
}) {
  const photos = photoUrls.slice(0, MAX_PHOTOS)
  const [active, setActive] = useState(0)
  const stripRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)

  const step = useCallback(
    (delta: number) =>
      setActive((current) => (current + delta + photos.length) % photos.length),
    [photos.length],
  )

  /** Keeps the chosen thumbnail in view when the strip is scrolled past it. */
  const select = useCallback((index: number) => {
    setActive(index)
    stripRef.current
      ?.querySelectorAll('button')
      [index]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
  }, [])

  function scrollStrip(delta: number) {
    stripRef.current?.scrollBy({ left: delta, behavior: 'smooth' })
  }

  if (photos.length === 0) {
    return (
      <div className="flex aspect-video w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-surface-warm via-surface to-brand-accent-soft">
        <div className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-canvas text-brand-accent shadow-sm">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-3M9 9h.01M9 12h.01M9 15h.01" />
            </svg>
          </div>
          <p className="text-body-sm font-semibold text-ink-primary">{clinicName}</p>
        </div>
      </div>
    )
  }

  const multiple = photos.length > 1

  return (
    <div className="space-y-3">
      <div
        className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-surface"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0]?.clientX ?? null
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current
          touchStartX.current = null
          if (start === null || !multiple) return
          const delta = (e.changedTouches[0]?.clientX ?? start) - start
          if (Math.abs(delta) < 40) return
          step(delta < 0 ? 1 : -1)
        }}
      >
        <Image
          src={photos[active]}
          alt={photos.length > 1 ? `${clinicName} photo ${active + 1} of ${photos.length}` : clinicName}
          fill
          sizes="(min-width: 1024px) 50vw, 100vw"
          className="object-cover"
          priority
        />

        {/* Frame arrows are mobile only: on desktop the strip below does the
            browsing, and a second control on the photo would be a duplicate. */}
        {multiple && (
          <>
            <button
              type="button"
              onClick={() => step(-1)}
              aria-label="Previous photo"
              className="absolute left-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface-canvas/90 text-ink-primary shadow-md transition hover:bg-surface-canvas md:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => step(1)}
              aria-label="Next photo"
              className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-surface-canvas/90 text-ink-primary shadow-md transition hover:bg-surface-canvas md:hidden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </>
        )}
      </div>

      {multiple && (
        <div className="flex items-center justify-center md:hidden">
          {photos.map((url, index) => (
            // The visible dot stays 8px; the button around it is 24px tall so it
            // can be hit with a thumb (2026-09-25, QA T4-05: was 20x8).
            <button
              key={url}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Show photo ${index + 1}`}
              aria-current={active === index}
              className="flex h-6 items-center px-1"
            >
              <span
                className={`block h-2 rounded-full transition-all ${
                  active === index ? 'w-5 bg-brand-primary' : 'w-2 bg-border'
                }`}
              />
            </button>
          ))}
        </div>
      )}

      {multiple && (
        <div className="hidden items-center gap-2 md:flex">
          <button
            type="button"
            onClick={() => scrollStrip(-240)}
            aria-label="Scroll thumbnails left"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-canvas text-ink-secondary transition hover:border-brand-accent hover:text-brand-accent"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>

          {/* scrollbar-none is not a Tailwind class here, so the strip keeps its
              native scrollbar on platforms that always show one. Acceptable: the
              arrows are the primary control and the strip stays draggable. */}
          <div ref={stripRef} className="flex min-w-0 flex-1 gap-2 overflow-x-auto scroll-smooth">
            {photos.map((url, index) => (
              <button
                key={url}
                type="button"
                onClick={() => select(index)}
                aria-label={`Show photo ${index + 1} of ${photos.length}`}
                aria-current={active === index}
                className={`relative h-16 w-24 shrink-0 overflow-hidden rounded-control border transition ${
                  active === index
                    ? 'border-brand-accent ring-1 ring-brand-accent'
                    : 'border-border opacity-80 hover:opacity-100'
                }`}
              >
                <Image
                  src={url}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollStrip(240)}
            aria-label="Scroll thumbnails right"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border bg-surface-canvas text-ink-secondary transition hover:border-brand-accent hover:text-brand-accent"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
