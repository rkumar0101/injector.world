import type { Metadata } from 'next'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { getClinicsListing, getClinicsStats } from '@/lib/clinic-queries'
import { getPayloadInstance } from '@/lib/payload-server'
import { getLocationFilterOptions, type StateFilterOption } from '@/lib/location-queries'
import { LocationPicker } from '@/components/shared/LocationPicker'
import { DEFAULT_OG_IMAGES } from '@/lib/seo-defaults'
import { ClinicsGrid } from './ClinicsGrid'

export const revalidate = 300

export const metadata: Metadata = {
  title: 'Aesthetic Clinics Directory',
  description:
    'Browse verified aesthetic clinics across the US. Read patient reviews, check credentials, and find clinics near you.',
  openGraph: { type: 'website', images: DEFAULT_OG_IMAGES },
}

export default async function ClinicsPage() {
  let clinics: Awaited<ReturnType<typeof getClinicsListing>> = []
  let stats = { total: 0, stateCount: 0, avgRating: '0.0' }
  let stateOptions: StateFilterOption[] = []
  let serviceOptions: Array<{ id: string; name: string }> = []
  let brandOptions: Array<{ id: string; name: string }> = []
  // Distinguishes "DB unreachable" from "genuinely zero clinics" so the grid
  // can show a retry state instead of a wrong-looking "no clinics match" empty
  // state. Both drive the client fallback to zero the same way the query
  // itself already fell back before 2026-08-19 -- that silent equivalence is
  // exactly what made a pool wedge look like an empty database.
  let loadFailed = false

  try {
    const payload = await getPayloadInstance()
    const [clinicsData, statsData, statesData, servicesRes, brandsRes] = await Promise.all([
      getClinicsListing(24),
      getClinicsStats(),
      getLocationFilterOptions(),
      payload.find({ collection: 'services', limit: 100, sort: 'name', depth: 0 }),
      payload.find({ collection: 'brands', limit: 200, sort: 'name', depth: 0 }),
    ])

    clinics = clinicsData
    stats = statsData
    stateOptions = statesData
    serviceOptions = (servicesRes.docs as any[]).map((s) => ({ id: String(s.id), name: s.name }))
    brandOptions = (brandsRes.docs as any[]).map((b) => ({ id: String(b.id), name: b.name }))
  } catch {
    // Also hit at build time (prerender with no DB), which is why this stays a
    // silent fallback rather than throwing -- the difference from before is
    // that the grid now knows which case it is in.
    loadFailed = true
  }

  return (
    <>
      <Header />

      {/* Page hero — always-dark navy band (matches Footer pattern) */}
      <section className="bg-[#0B1B34] text-white pb-8 pt-8 md:pb-10 md:pt-10">
        <div className="max-canvas max-w-4xl">
          <p className="eyebrow text-brand-accent mb-4 tracking-widest">Clinics</p>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight mb-5 max-w-[680px]">
            Verified aesthetic clinics.
          </h1>
          <p className="text-lede-m md:text-lede text-white/70 max-w-[600px] font-serif">
            Every clinic listed here is independently reviewed. Browse by state, read patient reviews, and book with confidence.
          </p>

          {/* Quick stats. loadFailed shows "—" rather than a wrong "0": a
              zero read as "the directory is empty" during the 2026-08-19 DB
              pool wedge, when the real count was 39,000+. */}
          <div className="flex flex-wrap gap-6 mt-10 pt-10 border-t border-white/10">
            {[
              { n: loadFailed ? '—' : stats.total > 0 ? stats.total.toLocaleString() : `${clinics.length}`, label: 'Clinics listed' },
              { n: loadFailed ? '—' : `${stats.stateCount > 0 ? stats.stateCount : Array.from(new Set(clinics.map((c) => c.state))).length}`, label: 'States' },
              { n: loadFailed ? '—' : stats.avgRating !== '0.0' ? stats.avgRating : '—', label: 'Average rating' },
            ].map(({ n, label }) => (
              <div key={label}>
                <div className="font-semibold text-[28px] leading-none text-white">{n}</div>
                <div className="text-caption text-white/60 mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* State picker, matching the brand and service pillar heroes. It
              replaces the <select> that used to sit in the grid's filter bar,
              and every state link ships in the served HTML. */}
          {stateOptions.length > 0 && (
            <LocationPicker
              states={stateOptions.map((s) => ({ ...s, count: s.clinicCount }))}
              basePath="/clinics"
            />
          )}
        </div>
      </section>

      {/* Grid + filters */}
      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          <ClinicsGrid
            initialClinics={clinics}
            totalClinics={stats.total || clinics.length}
            serviceOptions={serviceOptions}
            brandOptions={brandOptions}
            loadFailed={loadFailed}
          />
        </div>
      </section>

      {/* <PreFooterCta /> removed 2026-08-06 (client request), matching the
          homepage removal of 2026-07-31. The component itself is untouched. */}
      <Footer />
    </>
  )
}
