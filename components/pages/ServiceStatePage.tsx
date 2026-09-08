import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ZipPromoBanner } from '@/components/shared/ZipPromoBanner'
import { ComingSoonMarket } from '@/components/shared/ComingSoonMarket'
import { ServiceDirectory } from '@/components/pages/ServiceDirectory'
import { CountPill } from '@/components/shared/CountPill'
import { FaqAccordionItem } from '@/components/shared/FaqAccordionItem'
import { isMarketLive } from '@/lib/markets'
import type { ServiceStateData } from '@/lib/location-queries'
import type { ActiveBanner } from '@/lib/promotions'

type Props = { data: ServiceStateData; banner: ActiveBanner | null; schema: object[] }

export function ServiceStatePage({ data, banner, schema }: Props) {
  const { service, state, cities, clinics, faqs, totalClinics, relatedBrands } = data

  // Coming-soon market: state not live yet. Page is noindexed in generateMetadata.
  if (!isMarketLive(state)) {
    return (
      <>
        <Header />
        <div className="bg-surface border-b border-border">
          <div className="max-canvas py-3">
            <nav className="flex items-center gap-2 text-caption text-ink-tertiary flex-wrap" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-ink-primary transition">Home</Link>
              <span>/</span>
              <Link href={`/services/${service.slug}`} className="hover:text-ink-primary transition">{service.name}</Link>
              <span>/</span>
              <span className="text-ink-primary">{state.name}</span>
            </nav>
          </div>
        </div>
        <ComingSoonMarket
          overline={`${service.name} · Coming soon`}
          title={`${service.name} in ${state.name}`}
          placeName={state.name}
          stateCode={state.stateCode}
          links={[
            { href: `/services/${service.slug}`, label: `All ${service.name} providers` },
            { href: '/clinics', label: 'Browse all verified clinics' },
            { href: '/guides', label: 'Treatment guides' },
          ]}
        />
        <Footer />
      </>
    )
  }

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}

      <Header />

      {/* Ad banner */}
      <ZipPromoBanner fallback={banner} serviceId={data.service?.id ? String(data.service.id) : undefined} />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary flex-wrap" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <Link href={`/services/${service.slug}`} className="hover:text-ink-primary transition">{service.name}</Link>
            <span>/</span>
            <span className="text-ink-primary">{state.name}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <section className="bg-surface-canvas pt-10 pb-8 border-b border-border">
        <div className="max-canvas">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-3 block">
            {service.name} Directory
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            {service.name} in {state.name}
          </h1>
          {/* Sentence after the pill dropped 2026-08-07 (client request), and
              "verified" came out of the pill label with it, matching the
              service city page. */}
          {totalClinics > 0 && (
            <p className="flex flex-wrap items-center gap-2">
              <CountPill count={totalClinics} label={`${service.name} clinic${totalClinics !== 1 ? 's' : ''}`} />
            </p>
          )}
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas space-y-14">

          {/* Clinic listing with Brands-offered filter (locked rule: no Services filter here) */}
          <div>
            {clinics.length > 0 && (
              <h2 className="font-serif text-h2 text-ink-primary mb-5">
                {totalClinics.toLocaleString()} {service.name} clinic{totalClinics !== 1 ? 's' : ''} in {state.name}
              </h2>
            )}
            <ServiceDirectory
              clinics={clinics}
              serviceName={service.name}
              serviceSlug={service.slug}
              stateSlug={state.slug}
              totalClinics={totalClinics}
              brandOptions={relatedBrands}
            />
          </div>

          {/* Cities */}
          {cities.length > 0 && (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-6">{service.name} by city in {state.name}</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {cities.map((c) => (
                  <Link
                    key={c.slug}
                    href={`/services/${service.slug}/${state.slug}/${c.slug}`}
                    className="group flex items-center justify-between p-4 rounded-xl border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm transition-all"
                  >
                    <div>
                      <div className="font-medium text-body-sm text-ink-primary group-hover:text-brand-accent transition">{c.name}</div>
                      {c.clinicCount > 0 && <div className="text-caption text-ink-tertiary">{c.clinicCount.toLocaleString()}+ clinics</div>}
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-tertiary group-hover:text-brand-accent flex-shrink-0">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* FAQs */}
          {faqs.length > 0 && (
            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-5">Frequently asked questions</h2>
              <div className="space-y-2 max-w-3xl">
                {faqs.map((f) => (
                  <FaqAccordionItem
                    key={f.id}
                    question={f.question}
                    answer={f.answer}
                    detail={f.detail}
                    offLabel={f.offLabel}
                    safetyFlag={f.safetyFlag}
                    relatedGuideSlug={f.relatedGuideSlug}
                    relatedGuideTitle={f.relatedGuideTitle}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Internal links */}
          <div className="flex flex-wrap gap-3">
            <Link href={`/services/${service.slug}`} className="flex items-center gap-1.5 text-body-sm text-brand-accent hover:underline">
              All {service.name} clinics
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
            <Link href={`/clinics/${state.slug}`} className="flex items-center gap-1.5 text-body-sm text-brand-accent hover:underline">
              All clinics in {state.name}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}
