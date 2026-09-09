import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import type { ServiceIndexEntry } from '@/lib/location-queries'

type Props = { services: ServiceIndexEntry[]; schema: object[] }

/* CATEGORY_LABELS lived here until 2026-08-07. Its only use was the grey
   category label on the service cards, which the client dropped. */

export function ServicesIndexPage({ services, schema }: Props) {
  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}

      <Header />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <span className="text-ink-primary">Services</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      {/* Matched to the brand and service page heroes 2026-09-10: same cream
          band, same padding, same bottom border, no overline. This page and
          /brands were the last two on the two paths still using their own
          larger hero. */}
      <section className="bg-surface-warm border-b border-border pb-8 pt-8 md:pb-10 md:pt-10">
        <div className="max-canvas max-w-4xl">
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            Browse aesthetic services
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-ink-secondary">
            Every service we cover, from neurotoxins to fillers and skin therapies. Pick a service to find verified, license-checked injectors near you.
          </p>
        </div>
      </section>

      {/* Flat alphabetical grid */}
      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          {services.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
              {services.map((s) => (
                <Link
                  key={s.id}
                  href={`/services/${s.slug}`}
                  className="group flex flex-col p-5 md:p-6 rounded-xl border border-border bg-surface hover:border-brand-accent hover:bg-surface-warm hover:shadow-hover hover:-translate-y-[2px] transition-all duration-200"
                >
                  {/* Grey category label ("Skin", "Body", "Others") dropped
                      2026-08-07 (client request). */}
                  <span className="font-serif text-h3 text-ink-primary group-hover:text-brand-accent transition leading-snug">
                    {s.name}
                  </span>
                  {s.tagline && (
                    <span className="text-body-sm text-ink-secondary mt-2 leading-snug line-clamp-2">{s.tagline}</span>
                  )}
                  <span className="mt-auto pt-4 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-body-sm text-brand-accent font-medium">
                      Find clinics
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
                    </span>
                    {s.clinicCount > 0 && (
                      <span className="text-caption text-ink-tertiary">{s.clinicCount.toLocaleString()} clinics</span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-body text-ink-secondary">No services available yet.</p>
          )}
        </div>
      </div>

      <Footer />
    </>
  )
}
