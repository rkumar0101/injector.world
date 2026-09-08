import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ServiceDirectory } from '@/components/pages/ServiceDirectory'
import { ZipPromoBanner } from '@/components/shared/ZipPromoBanner'
import { CostEstimator } from '@/components/shared/CostEstimator'
import { RelatedQAs } from '@/components/shared/RelatedQAs'
import { LocationPicker } from '@/components/shared/LocationPicker'
import { CountPill } from '@/components/shared/CountPill'
import { FaqAccordionItem } from '@/components/shared/FaqAccordionItem'
import type { ServicePillarData } from '@/lib/location-queries'
import type { ActiveBanner } from '@/lib/promotions'

type Props = { data: ServicePillarData; banner: ActiveBanner | null; schema: object[] }


/* BODY_AREA_LABEL lived here until 2026-08-07; the body-area chips it labelled
   were dropped from the hero along with the Worth-It badge and the indices. */

export function ServicePillarPage({ data, banner, schema }: Props) {
  const { service, guide, serviceClinics, faqs, relatedQAs, states, relatedBrands, totalClinics } = data

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
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <span className="text-ink-primary">{service.name}</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      {/* Trimmed 2026-08-07 (client request) to match the brand pillar hero:
          headline, tagline, clinic count and the state picker. The category
          overline, short description, average cost, Worth-It badge, service
          indices and body-area chips all came out. The city dropdown that sat
          beside the state one was removed 2026-09-08. */}
      <section className="bg-surface-warm pb-8 pt-8 md:pb-10 md:pt-10">
        <div className="max-canvas max-w-4xl">
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            {service.name} Injectors
          </h1>
          {service.tagline && (
            <p className="font-serif text-lede-m md:text-lede text-ink-secondary">{service.tagline}</p>
          )}

          {totalClinics > 0 && (
            <div className="mt-5 flex flex-wrap gap-3">
              <CountPill count={totalClinics} label="clinics" />
            </div>
          )}

          <LocationPicker states={states} basePath={`/services/${service.slug}`} />
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas space-y-16">

          {/* The IP state hint, the full-width state grid and the "Popular:"
              city row lived here until 2026-08-07 (client request), replaced by
              the hero picker. That swap silently broke the crawl path: the
              picker's links were real <Link>s but were only mounted while the
              menu was open, so they never reached the served HTML. Fixed
              2026-09-07 by keeping the menu in the DOM and hiding it with CSS.
              Cities are reached from the state page, which lists them as plain
              anchors. */}

          {/* Directory: clinics offering this service */}
          <div>
            <h2 className="font-serif text-h2 text-ink-primary mb-8">
              Find a {service.name} clinic near you
            </h2>
            <ServiceDirectory
              clinics={serviceClinics}
              serviceName={service.name}
              serviceSlug={service.slug}
              totalClinics={totalClinics}
              brandOptions={relatedBrands}
            />
          </div>

          {/* Cost estimator */}
          {(service.avgPriceFromUsd || service.avgPriceToUsd) && (
            <CostEstimator
              serviceName={service.name}
              serviceSlug={service.slug}
              priceUnit={service.priceUnit}
              avgPriceFromUsd={service.avgPriceFromUsd}
              avgPriceToUsd={service.avgPriceToUsd}
            />
          )}

          {/* Risks note */}
          <div className="rounded-2xl border border-state-error/20 bg-state-error/5 p-6">
            <h2 className="font-serif text-h3 text-ink-primary mb-3">Risks and side effects</h2>
            <p className="text-body-sm text-ink-secondary leading-relaxed">
              {service.name} is generally considered safe when performed by a trained, licensed provider. Common side effects include temporary bruising, swelling, or redness at the injection site. Serious complications are rare but possible. Always consult a board-certified provider and disclose your full medical history before treatment.
            </p>
            {guide && (
              <Link href={`/guides/${guide.slug}`} className="inline-flex items-center gap-1.5 mt-3 text-body-sm text-brand-accent font-medium hover:underline">
                Read the full guide
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            )}
          </div>

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

          {/* Related Q&A */}
          <RelatedQAs qas={relatedQAs} serviceName={service.name} />

          {/* Guide CTA */}
          {guide && (
            <div className="rounded-2xl border border-border bg-surface-warm p-8 text-center">
              <h2 className="font-serif text-h2 text-ink-primary mb-3">{guide.title}</h2>
              <p className="text-body text-ink-secondary mb-6 max-w-xl mx-auto">{guide.lede}</p>
              <Link href={`/guides/${guide.slug}`}
                className="inline-flex items-center gap-2 bg-brand-primary text-surface-canvas rounded-control px-6 py-3 text-body-sm font-semibold hover:opacity-90 transition">
                Read the complete guide
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            </div>
          )}
        </div>
      </div>

      <Footer />
    </>
  )
}
