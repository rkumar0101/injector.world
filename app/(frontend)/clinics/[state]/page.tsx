import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isStateSlug, getLocationPrerenderParams } from '@/lib/route-resolver'
import { getStateHub } from '@/lib/location-queries'
import { getActiveBanner } from '@/lib/promotions'
import { isMarketLive } from '@/lib/markets'
import { getPageRobots } from '@/lib/page-index/queries'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ZipPromoBanner } from '@/components/shared/ZipPromoBanner'
import { ComingSoonMarket } from '@/components/shared/ComingSoonMarket'
import { StateHubPage } from '@/components/pages/StateHubPage'

/**
 * `/clinics/<state>` is the state hub.
 *
 * It was a 308 redirect into the Find path's `/<state>` for two days. That
 * redirect is deliberately gone: founder decision 2026-09-09 is one location
 * tree under `/clinics`, so this is now the real page and `/<state>` stops
 * existing. Do not re-add the redirect.
 *
 * The body below is the `state-hub` branch lifted out of the catch-all
 * `app/(frontend)/[...path]/page.tsx` as literally as possible. Only the urls
 * changed.
 */
export const revalidate = 600

export async function generateStaticParams() {
  try {
    const { stateSlugs } = await getLocationPrerenderParams()
    return stateSlugs.map((state) => ({ state }))
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string }>
}): Promise<Metadata> {
  const { state } = await params
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  const data = await getStateHub(state)
  if (!data) return {}

  const title = `Verified Injectors in ${data.state.name}`
  const desc = `Browse license-verified Botox and aesthetic injectors across ${data.state.name}. Real patient reviews.`
  return {
    title: { absolute: `${title} | injector.world` },
    description: desc,
    alternates: { canonical: `${siteUrl}/clinics/${state}` },
    ...(await getPageRobots(`/clinics/${state}`)),
  }
}

export default async function ClinicsStatePage({
  params,
}: {
  params: Promise<{ state: string }>
}) {
  const { state } = await params
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  // Same slug validation the redirect did, so junk slugs still 404 rather than
  // rendering an empty hub. Not `resolveRoute`: a bare `/alabama` no longer
  // resolves to anything, that shape was retired with the Find path.
  if (!(await isStateSlug(state))) notFound()

  const data = await getStateHub(state)
  if (!data) notFound()

  if (!isMarketLive(data.state)) {
    return (
      <>
        <Header />
        <ComingSoonMarket
          overline="Coming soon"
          title={`Aesthetic clinics in ${data.state.name}`}
          placeName={data.state.name}
          stateCode={data.state.stateCode}
          links={[
            { href: '/clinics', label: 'Browse all verified clinics' },
            { href: '/guides', label: 'Treatment guides' },
          ]}
        />
        <Footer />
      </>
    )
  }

  const banner = await getActiveBanner('state', undefined, data.state.id)

  // The `Clinics` crumb is new, not part of the port. At `/<state>` the old
  // schema of Home / Alabama skipped no level; at `/clinics/<state>` it skipped
  // one, and it disagreed with the clinic detail page, whose BreadcrumbList has
  // read Home / Clinics / State / City / Clinic all along. All three levels of
  // this tree now match the url and each other.
  const schema = [{
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Clinics', item: `${siteUrl}/clinics` },
      { '@type': 'ListItem', position: 3, name: data.state.name },
    ],
  }, ...(data.faqs.length > 0 ? [{
    '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: data.faqs.map((f) => ({
      '@type': 'Question', name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.detail ? `${f.answer} ${f.detail}` : f.answer },
    })),
  }] : [])]

  return (
    <>
      <Header />
      <ZipPromoBanner fallback={banner} />
      <StateHubPage data={data} schema={schema} />
      <Footer />
    </>
  )
}
