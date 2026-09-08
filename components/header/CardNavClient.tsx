'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Logo } from './Logo'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { useSession } from '@/components/account/SessionContext'
import { practiceCta } from '@/lib/auth-redirect'
import { navLeadFallback, type NavLead } from '@/lib/site-nav'
import type { HeaderNavItem, HeaderNavData } from '@/lib/header-config-queries'
import type { SessionUser } from './Header'

const NAV_CLOSED = 64

type AccordionSection = 'brands' | 'services' | 'clinics'

const RightArrow = () => (
  <svg aria-hidden width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
  </svg>
)

function AccordionPanel({
  id,
  label,
  items,
  viewAllLabel,
  viewAllHref,
  isOpen,
  onToggle,
  onNavigate,
}: {
  id: AccordionSection
  label: string
  items: HeaderNavItem[]
  viewAllLabel: string
  viewAllHref: string
  isOpen: boolean
  onToggle: () => void
  onNavigate: () => void
}) {
  const contentRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState(0)

  useLayoutEffect(() => {
    const el = contentRef.current
    if (!el) return
    if (isOpen) {
      setHeight(el.scrollHeight)
    } else {
      setHeight(0)
    }
  }, [isOpen, items.length])

  return (
    <div className="border-b border-border-subtle last:border-b-0">
      <button
        type="button"
        id={`nav-${id}-btn`}
        aria-expanded={isOpen}
        aria-controls={`nav-${id}`}
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3.5 text-left hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition rounded-none"
      >
        <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-ink-secondary">{label}</span>
        <svg
          aria-hidden
          width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
          className={`text-ink-tertiary transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div
        id={`nav-${id}`}
        role="region"
        aria-labelledby={`nav-${id}-btn`}
        style={{ height: `${height}px`, overflow: 'hidden', transition: 'height 300ms cubic-bezier(0.4,0,0.2,1)' }}
      >
        <div ref={contentRef} className="px-4 pb-4 pt-1">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mb-3">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className="text-[13px] text-ink-secondary hover:text-brand-accent hover:underline transition-colors leading-snug truncate"
              >
                {item.label}
              </Link>
            ))}
          </div>
          <div className="pt-2.5 border-t border-border-subtle">
            <Link
              href={viewAllHref}
              onClick={onNavigate}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-brand-accent hover:opacity-75 transition-opacity"
            >
              {viewAllLabel}
              <RightArrow />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export function CardNavClient({
  user: initialUser,
  lead,
  navData,
}: {
  user: SessionUser | null
  lead?: NavLead | null
  navData: HeaderNavData
}) {
  const { user: sessionUser } = useSession()
  const user = initialUser ?? sessionUser
  const leadData = lead ?? navLeadFallback

  const [open, setOpen] = useState(false)
  const [activeSection, setActiveSection] = useState<AccordionSection | null>(null)
  const [navHeight, setNavHeight] = useState(NAV_CLOSED)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()

  // Default: Brands open on desktop, all closed on mobile
  useEffect(() => {
    setActiveSection(window.innerWidth >= 768 ? 'brands' : null)
  }, [])

  // Track the mobile breakpoint (matches Tailwind's md:) so the scroll lock
  // below stays mobile-only and releases if the viewport crosses over.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobile(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  // Lock background scroll while the drawer is open (mobile only). The drawer
  // itself keeps its own overflow-y-auto, so it still scrolls internally.
  useEffect(() => {
    if (!open || !isMobile) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [open, isMobile])

  // Close on route change
  useEffect(() => { setOpen(false) }, [pathname])

  // Avatar outside click
  useEffect(() => {
    if (!avatarOpen) return
    function onOutside(e: MouseEvent) {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) setAvatarOpen(false)
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [avatarOpen])

  // ESC to close
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') { setOpen(false); setAvatarOpen(false) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Height tracking — re-measure whenever open state or active section changes
  useLayoutEffect(() => {
    function measure() {
      if (open) {
        const panel = panelRef.current
        const natural = NAV_CLOSED + (panel ? panel.scrollHeight + 4 : 320)
        // -16px leaves room for the wrapper's 10px top padding, so a very tall
        // drawer's bottom edge stays inside the viewport instead of running off.
        setNavHeight(Math.min(natural, window.innerHeight - 16))
      } else {
        setNavHeight(NAV_CLOSED)
      }
    }
    measure()
    // Wait for accordion CSS transition to settle, then re-measure
    const t = setTimeout(measure, 320)
    window.addEventListener('resize', measure)
    return () => { clearTimeout(t); window.removeEventListener('resize', measure) }
  }, [open, activeSection])

  function toggleSection(section: AccordionSection) {
    setActiveSection((prev) => prev === section ? null : section)
  }

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user?.email?.[0]?.toUpperCase() ?? '?'
  const dashboardLink = user?.role === 'admin' || user?.role === 'editor' ? '/admin' : '/dashboard'
  const cta = practiceCta(user)

  return (
    <>
      <header className="sticky top-0 z-40">
        {/* Backdrop — mobile only. Dims the page behind the open drawer and
            closes it on tap. Sits under the nav wrapper's z-10. */}
        <div
          aria-hidden
          onClick={() => setOpen(false)}
          className={`md:hidden fixed inset-0 bg-black/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        />

        {/* Fixed flow height (10px top padding + 64px bar) on both breakpoints,
            so the nav card grows *over* the page when it opens instead of
            pushing the content below it down. Desktop used to be md:h-auto,
            which let the header's own box grow with the open drawer and shove
            the hero down the page (2026-08-11 bug, client-reported). */}
        <div className="relative z-10 h-[74px] px-3 md:px-6 pt-2.5">
          <nav
            className="max-w-[1280px] mx-auto rounded-2xl bg-white/70 dark:bg-[#0B1B34]/80 backdrop-blur-xl border border-white/50 dark:border-white/10 shadow-hover transition-[height] duration-[420ms] ease-out"
            style={{ height: navHeight, overflow: (avatarOpen && !open) ? 'visible' : 'hidden' }}
          >
            {/* ── Top bar ─────────────────────────────────────────────── */}
            <div className="relative flex items-center justify-between h-[64px] px-4 md:px-5">

              {/* Hamburger */}
              <button
                type="button"
                onClick={() => setOpen(v => !v)}
                aria-label={open ? 'Close menu' : 'Open menu'}
                aria-expanded={open}
                className="flex flex-col gap-[6px] w-11 h-11 items-center justify-center rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition"
              >
                <span className={`block h-[2px] bg-ink-primary rounded-full transition-all duration-300 origin-center ${open ? 'w-5 translate-y-[8px] rotate-45' : 'w-6'}`} />
                <span className={`block h-[2px] bg-ink-primary rounded-full transition-all duration-300 ${open ? 'opacity-0 w-5' : 'w-6'}`} />
                <span className={`block h-[2px] bg-ink-primary rounded-full transition-all duration-300 origin-center ${open ? 'w-5 -translate-y-[8px] -rotate-45' : 'w-6'}`} />
              </button>

              {/* Logo — centered */}
              <div className="absolute left-1/2 -translate-x-1/2">
                <Logo />
              </div>

              {/* Right actions */}
              <div className="flex items-center gap-1.5 md:gap-2">
                {user ? (
                  <div ref={avatarRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setAvatarOpen(v => !v)}
                      aria-expanded={avatarOpen}
                      aria-label="Account menu"
                      className="w-8 h-8 rounded-full bg-brand-primary text-surface-canvas flex items-center justify-center text-[11px] font-bold flex-shrink-0"
                    >
                      {initials}
                    </button>
                    {avatarOpen && (
                      <div className="absolute right-0 top-full mt-2 w-44 bg-surface-canvas rounded-xl border border-border shadow-lg py-1 z-50">
                        <Link href={dashboardLink} onClick={() => setAvatarOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-body-sm text-ink-primary hover:bg-surface transition">
                          {user.role === 'admin' || user.role === 'editor' ? 'Admin panel' : 'Dashboard'}
                        </Link>
                        <div className="border-t border-border-subtle my-1" />
                        <LogoutButton className="w-full flex items-center gap-2.5 px-4 py-2.5 text-body-sm text-ink-secondary hover:text-ink-primary hover:bg-surface transition text-left">
                          Sign out
                        </LogoutButton>
                      </div>
                    )}
                  </div>
                ) : (
                  <Link href="/login" className="flex items-center gap-1.5 w-11 h-11 justify-center sm:w-auto sm:h-auto sm:px-3 sm:py-1.5 text-[13px] font-medium text-ink-secondary hover:text-ink-primary rounded-lg hover:bg-black/[0.04] dark:hover:bg-white/[0.06] transition" aria-label="Sign in">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0116 0" /></svg>
                    <span className="hidden sm:inline">Sign in</span>
                  </Link>
                )}

                <Link
                  href={cta.href}
                  className="hidden md:inline-flex items-center bg-brand-primary text-surface-canvas rounded-control px-4 py-2 text-[13px] font-medium hover:opacity-90 transition"
                >
                  {cta.label}
                </Link>
              </div>
            </div>

            {/* ── Drawer ──────────────────────────────────────────────── */}
            <div ref={panelRef} className="px-2.5 pb-2.5 overflow-y-auto overscroll-contain" style={{ maxHeight: `calc(100dvh - ${NAV_CLOSED + 16}px)` }}>

              {/* Editorial lead strip */}
              <div className={`pb-2 transition-[opacity,transform] duration-[380ms] ease-out ${open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                <div className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface-warm/80 p-2.5">
                  <Link href={leadData.href} onClick={() => setOpen(false)} className="flex items-center gap-3 min-w-0 flex-1 group">
                    <span className="w-[60px] h-[46px] md:w-[64px] rounded-lg bg-[#0B1B34] flex items-center justify-center text-brand-accent flex-shrink-0" aria-hidden>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M4 5a1 1 0 0 0-1 1v12a2 2 0 0 0 2 2h13" />
                        <path d="M5 5h11a2 2 0 0 1 2 2v11a1 1 0 0 0 2 0V9" />
                        <line x1="7" y1="9" x2="13" y2="9" /><line x1="7" y1="13" x2="11" y2="13" />
                      </svg>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-[0.07em] font-semibold text-brand-accent">{leadData.overline}</span>
                      <span
                        className="block font-serif text-[15px] md:text-[16px] text-ink-primary leading-snug mt-0.5 group-hover:opacity-70 transition-opacity"
                        style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
                      >
                        {leadData.title}
                      </span>
                    </span>
                  </Link>
                  <Link
                    href={leadData.allHref}
                    onClick={() => setOpen(false)}
                    className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-brand-accent whitespace-nowrap hover:opacity-70 transition-opacity"
                  >
                    {leadData.allLabel}
                    <RightArrow />
                  </Link>
                </div>
              </div>

              {/* Accordion */}
              <div
                className={`rounded-xl border border-border-subtle bg-white/40 dark:bg-white/[0.04] overflow-hidden transition-[opacity,transform] duration-[380ms] ease-out ${open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: open ? '55ms' : '0ms' }}
              >
                {/* Home — plain link. Logo already goes home, but not every
                    visitor knows that, so this is an explicit way back. */}
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center px-4 py-3.5 border-b border-border-subtle hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition"
                >
                  <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-ink-secondary">
                    Home
                  </span>
                </Link>
                <AccordionPanel
                  id="brands"
                  label="Brands"
                  items={navData.brands}
                  viewAllLabel="Browse all brands"
                  viewAllHref="/brands"
                  isOpen={activeSection === 'brands'}
                  onToggle={() => toggleSection('brands')}
                  onNavigate={() => setOpen(false)}
                />
                <AccordionPanel
                  id="services"
                  label="Services"
                  items={navData.services}
                  viewAllLabel="Browse all services"
                  viewAllHref="/services"
                  isOpen={activeSection === 'services'}
                  onToggle={() => toggleSection('services')}
                  onNavigate={() => setOpen(false)}
                />
                {/* Clinics — an accordion of state hubs since 2026-09-09, when
                    the location tree moved under /clinics. Was a plain link to
                    the directory; "Browse all clinics" still goes there.

                    AccordionPanel keeps every link in the DOM and collapses with
                    height: 0. That is deliberate and load-bearing: it means these
                    state urls ship in the served HTML and are crawlable. Do not
                    "optimise" it into a conditional render. */}
                <AccordionPanel
                  id="clinics"
                  label="Clinics"
                  items={navData.clinics}
                  viewAllLabel="Browse all clinics"
                  viewAllHref="/clinics"
                  isOpen={activeSection === 'clinics'}
                  onToggle={() => toggleSection('clinics')}
                  onNavigate={() => setOpen(false)}
                />
                {/* Educational Guides — plain link. Was an accordion of
                    hand-picked guides whose hrefs pointed at slugs
                    that never existed in the DB. The index page is the source
                    of truth, so we link straight to it. */}
                <Link
                  href="/guides"
                  onClick={() => setOpen(false)}
                  className="w-full flex items-center px-4 py-3.5 border-b border-border-subtle hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition"
                >
                  <span className="text-[11px] uppercase tracking-[0.08em] font-semibold text-ink-secondary">
                    Educational Guides
                  </span>
                </Link>
              </div>

              {/* Practice CTA — mobile only. The top-bar CTA is hidden below md,
                  so the drawer carries it instead. Label/href are role-aware. */}
              <div
                className={`md:hidden pt-2.5 transition-[opacity,transform] duration-[380ms] ease-out ${open ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
                style={{ transitionDelay: open ? '110ms' : '0ms' }}
              >
                <Link
                  href={cta.href}
                  onClick={() => setOpen(false)}
                  className="flex w-full items-center justify-center bg-brand-primary text-surface-canvas rounded-control px-4 py-3 text-[14px] font-medium hover:opacity-90 transition"
                >
                  {cta.label}
                </Link>
              </div>
            </div>
          </nav>
        </div>
      </header>
    </>
  )
}
