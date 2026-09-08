'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import type { StateRow } from '@/lib/home-queries'

function formatProviders(n: number): string {
  if (n <= 0) return ''
  if (n >= 1000) return `${(Math.floor(n / 100) * 100).toLocaleString()}+`
  if (n >= 100) return `${Math.floor(n / 50) * 50}+`
  return `${n}+`
}

const Chevron = ({ muted }: { muted?: boolean }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    className={`${muted ? 'text-white/25' : 'text-white/50'} group-hover:text-[#3FA68A] group-hover:translate-x-0.5 transition flex-shrink-0`}
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
)

function StateCard({
  state,
  className,
  style,
}: {
  state: StateRow
  className: string
  style: CSSProperties
}) {
  const live = state.isLive
  return (
    <Link href={`/clinics/${state.slug}`} data-id={state.id} style={style} className={className}>
      <div className="flex flex-col flex-1 min-w-0 mr-2">
        <span
          className={`text-body-sm font-medium truncate leading-tight ${live ? 'text-white' : 'text-white/55'}`}
        >
          {state.name}
        </span>
        {live ? (
          state.providerCount > 0 && (
            <span className="text-[11px] text-white/40 leading-tight mt-0.5">
              {formatProviders(state.providerCount)} providers
            </span>
          )
        ) : (
          <span className="inline-flex items-center gap-1 text-[11px] text-white/40 leading-tight mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-white/30" aria-hidden />
            Coming soon
          </span>
        )}
      </div>
      <Chevron muted={!live} />
    </Link>
  )
}

export function BrowseStateClient({ states }: { states: StateRow[] }) {
  const [expanded, setExpanded] = useState(false)
  const [visibleSet, setVisibleSet] = useState(new Set<string>())
  const ref = useRef<HTMLDivElement>(null)

  const allFeatured = states.filter((s) => s.featured)
  const featured = allFeatured.slice(0, 10)
  const rest = [...allFeatured.slice(10), ...states.filter((s) => !s.featured)]

  useEffect(() => {
    if (!ref.current) return
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const id = (e.target as HTMLElement).dataset.id
            if (id) setVisibleSet((prev) => new Set(prev).add(id))
          }
        })
      },
      { threshold: 0.1, rootMargin: '60px 0px' },
    )
    ref.current.querySelectorAll('[data-id]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [expanded])

  function cardClass(s: StateRow, i: number, groupIndex: number) {
    const delay = visibleSet.has(s.id) ? `${(groupIndex % 12) * 30}ms` : '0ms'
    // Non-live (coming-soon) markets render dimmer but stay clickable so the
    // visitor still lands on the coming-soon page + waitlist.
    const tone = s.isLive
      ? 'bg-white/5 border-white/10 hover:bg-white/10'
      : 'bg-white/[0.03] border-white/[0.07] hover:bg-white/[0.06]'
    return {
      className: `group flex items-center justify-between px-3.5 py-3 rounded-xl border hover:border-[#3FA68A] transition-all duration-300 ${tone} ${
        visibleSet.has(s.id) ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
      }`,
      style: { transitionDelay: delay },
    }
  }

  return (
    <div ref={ref}>
      {/* Featured 10 (capped for clean 2×5 grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 md:gap-3">
        {featured.map((s, i) => {
          const { className, style } = cardClass(s, i, i)
          return <StateCard key={s.id} state={s} className={className} style={style} />
        })}
      </div>

      {/* Rest: animated expand */}
      {rest.length > 0 && (
        <div
          style={{
            maxHeight: expanded ? '2400px' : '0px',
            transition: 'max-height 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
            overflow: 'hidden',
          }}
        >
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 md:gap-3 mt-2.5 md:mt-3">
            {rest.map((s, i) => {
              const { className, style } = cardClass(s, i, i)
              return <StateCard key={s.id} state={s} className={className} style={style} />
            })}
          </div>
        </div>
      )}

      {!expanded && rest.length > 0 && (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-control bg-white/8 border border-white/15 text-body-sm text-white hover:bg-white/12 hover:border-[#3FA68A] transition"
          >
            <span>+ {rest.length} more states</span>
          </button>
        </div>
      )}
    </div>
  )
}
