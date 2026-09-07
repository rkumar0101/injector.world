import type { Metadata } from 'next'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { getPayloadInstance } from '@/lib/payload-server'
import { USMapClient } from '@/components/states/USMapClient'
import { StateDropdown } from '@/components/states/StateDropdown'

export const revalidate = 300

export const metadata: Metadata = {
  title: { absolute: 'Browse aesthetic clinics by state | injector.world' },
  description:
    'Find Botox and filler clinics in every US state. Browse our directory state by state.',
  alternates: { canonical: 'https://injector.world/states' },
}

export default async function StatesIndexPage() {
  const payload = await getPayloadInstance()
  const res = await payload.find({
    collection: 'locations',
    where: { kind: { equals: 'state' } },
    limit: 60,
    sort: 'name',
    depth: 0,
  })

  const counts = new Map<string, number>()
  try {
    const pool = (payload.db as any).pool
    const r = await pool.query(
      `SELECT upper(state) AS code, count(*)::int AS n FROM clinics
       WHERE status = 'published' AND state IS NOT NULL GROUP BY upper(state)`,
    )
    for (const row of r.rows) counts.set(String(row.code).toUpperCase(), Number(row.n))
  } catch { /* fall back to 0 counts */ }

  const states = (res.docs as any[]).map((s) => ({
    name: s.name,
    slug: s.slug,
    abbr: String(s.state ?? '').toUpperCase(),
    isLive: s.isLive === true,
    clinicCount: counts.get(String(s.state ?? '').toUpperCase()) ?? 0,
  }))

  const live = states.filter((s) => s.isLive).sort((a, b) => b.clinicCount - a.clinicCount)
  const soon = states.filter((s) => !s.isLive).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
      <Header />

      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <span className="text-ink-primary">States</span>
          </nav>
        </div>
      </div>

      <section className="bg-surface-canvas pt-10 pb-8 border-b border-border">
        <div className="max-canvas">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3 block">
            Browse by State
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            Aesthetic clinics in every state
          </h1>
          <p className="text-body-lg text-ink-secondary max-w-2xl">
            Browse Botox and filler clinics near you. Live markets are open now, the rest are coming soon.
          </p>
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas space-y-14">
          {/* Interactive US map */}
          <USMapClient states={states} />

          {/* The "Live now" and "Coming soon" grids (50-odd tiles) became this
              dropdown on 2026-08-07 (client request). Live states are listed
              first, with their clinic count; the rest are marked "Soon".

              A comment here used to say the crawl path to every state page was
              unchanged because the menu items are real links. That was wrong:
              the menu was mounted only while open, so the links were absent
              from the served HTML. StateDropdown now keeps them mounted and
              hides them with CSS, so the crawl path really is intact. The map
              above is decorative for this purpose: it navigates from onClick on
              SVG paths and contains no anchors. */}
          {states.length > 0 && (
            <div>
              <h2 className="font-serif text-h3 text-ink-primary mb-5">Browse by state</h2>
              <StateDropdown states={[...live, ...soon]} />
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  )
}
