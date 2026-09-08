import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { isCitySlug, getLocationPrerenderParams } from '@/lib/route-resolver'
import { getCityHub } from '@/lib/location-queries'
import { isMarketLive } from '@/lib/markets'
import { getPageRobots } from '@/lib/page-index/queries'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ComingSoonMarket } from '@/components/shared/ComingSoonMarket'
import { CityHubPage } from '@/components/pages/CityHubPage'

/**
 * `/clinics/<state>/<city>` is the city hub. Same story as the state level one
 * directory up: it was a 308 redirect into the Find path's `/<state>/<city>`,
 * and deleting that redirect is the point. One location tree under `/clinics`,
 * founder decision 2026-09-09. Do not re-add the redirect.
 *
 * The body is the `city-hub` branch lifted out of the catch-all
 * `app/(frontend)/[...path]/page.tsx`, urls changed and nothing else.
 *
 * This file sits alongside `[slug]/page.tsx` (the clinic detail page). That is
 * legal in the App Router and already worked before this change.
 */
export const revalidate = 600

export async function generateStaticParams() {
  try {
    const { topCities } = await getLocationPrerenderParams()
    return topCities.map(({ stateSlug, citySlug }) => ({ state: stateSlug, city: citySlug }))
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ state: string; city: string }>
}): Promise<Metadata> {
  const { state, city } = await params
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  const data = await getCityHub(state, city)
  if (!data) return {}

  const cityDisplay = data.city.name.replace(/\s+city$/i, '')
  const title = `Aesthetic Injectors in ${cityDisplay}, ${data.city.stateCode}`
  const desc = `Browse ${data.services.length} services and verified aesthetic providers in ${cityDisplay}. Choose a service to see license-checked injectors near you.`
  return {
    title: { absolute: `${title} | injector.world` },
    description: desc,
    alternates: { canonical: `${siteUrl}/clinics/${state}/${city}` },
    ...(await getPageRobots(`/clinics/${state}/${city}`)),
  }
}

export default async function ClinicsCityPage({
  params,
}: {
  params: Promise<{ state: string; city: string }>
}) {
  const { state, city } = await params
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  // Same slug validation the redirect did, so junk slugs still 404. Not
  // `resolveRoute`: `/alabama/birmingham-al` no longer resolves to anything.
  if (!(await isCitySlug(state, city))) notFound()

  const data = await getCityHub(state, city)
  if (!data) notFound()

  if (!isMarketLive(data.city)) {
    const cityDisplay = data.city.name.replace(/\s+city$/i, '')
    return (
      <>
        <Header />
        <ComingSoonMarket
          overline="Coming soon"
          title={`Aesthetic injectors in ${cityDisplay}, ${data.city.stateCode}`}
          placeName={cityDisplay}
          cityTag={cityDisplay}
          stateCode={data.city.stateCode}
          links={[
            ...(data.stateLocation ? [{ href: `/clinics/${data.stateLocation.slug}`, label: `All of ${data.stateLocation.name}` }] : []),
            { href: '/clinics', label: 'Browse all verified clinics' },
            { href: '/guides', label: 'Treatment guides' },
          ]}
        />
        <Footer />
      </>
    )
  }

  // The `Clinics` crumb is new, not part of the port. See the note on the state
  // page one directory up: the ported schema skipped the /clinics level and
  // disagreed with the clinic detail page's own BreadcrumbList.
  const schema = [{
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: 'Clinics', item: `${siteUrl}/clinics` },
      ...(data.stateLocation ? [{ '@type': 'ListItem', position: 3, name: data.stateLocation.name, item: `${siteUrl}/clinics/${data.stateLocation.slug}` }] : []),
      { '@type': 'ListItem', position: data.stateLocation ? 4 : 3, name: data.city.name },
    ],
  }]

  return (
    <>
      <Header />
      <CityHubPage data={data} schema={schema} />
      <Footer />
    </>
  )
}
