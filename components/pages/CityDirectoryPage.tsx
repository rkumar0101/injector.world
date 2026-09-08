import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { DirectoryClinicsView } from '@/components/shared/DirectoryClinicsView'
import { ZipPromoBanner } from '@/components/shared/ZipPromoBanner'
import { ComingSoonMarket } from '@/components/shared/ComingSoonMarket'
import { CountPill } from '@/components/shared/CountPill'
import { FaqAccordionItem } from '@/components/shared/FaqAccordionItem'
import { isMarketLive } from '@/lib/markets'
import type { CityDirectoryData } from '@/lib/location-queries'
import type { ActiveBanner } from '@/lib/promotions'

type Props = {
  data: CityDirectoryData
  banner: ActiveBanner | null
  schema: object[]
}

function EmptyDirectoryState({
  serviceName,
  serviceSlug,
  cityName,
  stateLocation,
  nearbyFallback,
}: {
  serviceName: string
  serviceSlug: string
  cityName: string
  stateLocation: { slug: string; name: string } | null
  nearbyFallback: { label: string; stateSlug: string; citySlug: string } | null
}) {
  const fallback = nearbyFallback ?? undefined
  return (
    <div className="rounded-2xl border border-border bg-surface p-8 text-center">
      <div className="w-14 h-14 rounded-full bg-brand-accent-soft flex items-center justify-center mx-auto mb-4">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
      </div>
      <h2 className="font-serif text-h3 text-ink-primary mb-2">
        No verified clinics listed in {cityName} yet
      </h2>
      <p className="text-body-sm text-ink-secondary max-w-md mx-auto mb-6">
        We are actively adding clinics to this area. In the meantime, browse verified {serviceName.toLowerCase()} clinics in nearby cities.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        {stateLocation && (
          <Link
            href={`/services/${serviceSlug}/${stateLocation.slug}`}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-control bg-brand-primary text-surface-canvas text-body-sm font-semibold hover:opacity-90 transition"
          >
            Browse {stateLocation.name} clinics
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
          </Link>
        )}
        {fallback && (
          <Link
            href={`/services/${serviceSlug}/${fallback.stateSlug}/${fallback.citySlug}`}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-control border border-border text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:text-brand-accent transition"
          >
            {fallback.label} clinics
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
          </Link>
        )}
        <Link
          href={`/services/${serviceSlug}`}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-control border border-border text-body-sm font-medium text-ink-secondary hover:border-brand-accent hover:text-ink-primary transition"
        >
          All {serviceName} clinics
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
        </Link>
      </div>
    </div>
  )
}

export function CityDirectoryPage({ data, banner, schema }: Props) {
  const { service, city, stateLocation, clinics, faqs, totalClinics } = data
  const stateCode = city.stateCode
  const cityDisplayName = city.name.replace(/\s+city$/i, '')

  // Coming-soon market: city not live yet. Render waitlist instead of the
  // directory. Page is noindexed in generateMetadata.
  if (!isMarketLive(city)) {
    return (
      <>
        <Header />
        <div className="bg-surface border-b border-border">
          <div className="max-canvas py-3">
            <nav className="flex items-center gap-2 text-caption text-ink-tertiary flex-wrap" aria-label="Breadcrumb">
              <Link href="/" className="hover:text-ink-primary transition">Home</Link>
              {stateLocation && (
                <>
                  <span>/</span>
                  <Link href={`/clinics/${stateLocation.slug}`} className="hover:text-ink-primary transition">{stateLocation.name}</Link>
                </>
              )}
              <span>/</span>
              <span className="text-ink-primary">{city.name}</span>
            </nav>
          </div>
        </div>
        <ComingSoonMarket
          overline={`${service.name} · Coming soon`}
          title={`${service.name} in ${cityDisplayName}, ${stateCode}`}
          placeName={cityDisplayName}
          cityTag={cityDisplayName}
          stateCode={stateCode}
          links={[
            { href: `/services/${service.slug}`, label: `All ${service.name} providers` },
            ...(stateLocation ? [{ href: `/services/${service.slug}/${stateLocation.slug}`, label: `${service.name} in ${stateLocation.name}` }] : []),
            { href: '/clinics', label: 'Browse all verified clinics' },
          ]}
        />
        <Footer />
      </>
    )
  }

  const breadcrumbItems = [
    { href: '/', label: 'Home' },
    ...(stateLocation ? [{ href: `/clinics/${stateLocation.slug}`, label: stateLocation.name }] : []),
    ...(stateLocation ? [{ href: `/services/${service.slug}/${stateLocation.slug}`, label: `${service.name} in ${stateLocation.name}` }] : []),
    { label: city.name },
  ]

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}

      <Header />

      <ZipPromoBanner fallback={banner} serviceId={data.service?.id ? String(data.service.id) : undefined} />

      {/* Breadcrumb */}
      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary flex-wrap" aria-label="Breadcrumb">
            {breadcrumbItems.map((item, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span>/</span>}
                {item.href ? (
                  <Link href={item.href} className="hover:text-ink-primary transition">{item.label}</Link>
                ) : (
                  <span className="text-ink-primary">{item.label}</span>
                )}
              </span>
            ))}
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
            {service.name} in {cityDisplayName}, {stateCode}
          </h1>
          {/* Dropped 2026-08-07 (client request): the sentence after the pill,
              the word "verified" in the pill, and the two check-mark trust
              lines under it. */}
          {totalClinics > 0 && (
            <p className="flex flex-wrap items-center gap-2">
              <CountPill count={totalClinics} label={`${service.name} clinic${totalClinics !== 1 ? 's' : ''}`} />
            </p>
          )}
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          {/* Single column as of 2026-08-07 (client request). The right rail
              (Explore more links, the guide card and the trust box) is gone, so
              the page is the listing: DirectoryClinicsView already puts its
              filters on the left and the clinics on the right. */}
          <div>
              {clinics.length === 0 ? (
                <EmptyDirectoryState
                  serviceName={service.name}
                  serviceSlug={service.slug}
                  cityName={cityDisplayName}
                  stateLocation={stateLocation ?? null}
                  nearbyFallback={data.nearbyFallback}
                />
              ) : (
                <DirectoryClinicsView
                  clinics={clinics}
                  totalClinics={totalClinics}
                  loadMoreUrl={
                    stateLocation
                      ? `/api/service-city-clinics?serviceSlug=${encodeURIComponent(service.slug)}&stateSlug=${encodeURIComponent(stateLocation.slug)}&citySlug=${encodeURIComponent(city.slug)}`
                      : undefined
                  }
                  brandOptions={data.relatedBrands.map((b) => ({ id: b.id, name: b.name }))}
                />
              )}

              {/* FAQs */}
              {faqs.length > 0 && (
                <div className="mt-12">
                  <h2 className="font-serif text-h3 text-ink-primary mb-5">Frequently asked questions</h2>
                  <div className="space-y-2">
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

            {/* The right rail lived here until 2026-08-07 (client request):
                "Explore more" links, the treatment-guide card and the trust
                box. */}
          </div>
        </div>
      </div>

      <Footer />
    </>
  )
}
