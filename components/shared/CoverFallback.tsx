import Image from 'next/image'

/**
 * Branded stand-in for an article or guide with no cover image (2026-09-25,
 * docs/FIX-ALL-PLAN-2026-09-24.md 4.1 / 4.2). 99 of 100 guides and most news
 * articles have no cover yet; the guide card used to show an empty grey box.
 * Fills its positioned parent (the card's aspect-ratio frame).
 */
export function CoverFallback({ label }: { label?: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-surface-warm">
      <Image src="/iw-mark.png" alt="" width={44} height={44} className="h-11 w-11 opacity-90" />
      {label && (
        <span className="text-overline uppercase tracking-widest font-semibold text-ink-tertiary">{label}</span>
      )}
    </div>
  )
}
