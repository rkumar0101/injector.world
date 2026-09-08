import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { resolveRoute, getAllRoutePaths } from '@/lib/route-resolver'
import {
  getCityDirectory, getServicePillar, getServiceState, getServicesIndex,
} from '@/lib/location-queries'
import {
  getBrandsIndex, getBrandPillar, getBrandState, getBrandCityDirectory,
} from '@/lib/brand-queries'
import { getActiveBanner } from '@/lib/promotions'
import { getPageRobots } from '@/lib/page-index/queries'
import { DEFAULT_OG_IMAGES } from '@/lib/seo-defaults'
import { CityDirectoryPage } from '@/components/pages/CityDirectoryPage'
import { ServicePillarPage } from '@/components/pages/ServicePillarPage'
import { ServiceStatePage } from '@/components/pages/ServiceStatePage'
import { ServicesIndexPage } from '@/components/pages/ServicesIndexPage'
import { BrandsIndexPage } from '@/components/pages/BrandsIndexPage'
import { BrandPillarPage } from '@/components/pages/BrandPillarPage'
import { BrandStatePage } from '@/components/pages/BrandStatePage'
import { BrandCityDirectoryPage } from '@/components/pages/BrandCityDirectoryPage'

export const revalidate = 600

export async function generateStaticParams() {
  try {
    const paths = await getAllRoutePaths()
    return paths.map((p) => ({ path: p }))
  } catch {
    return []
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ path: string[] }>
}): Promise<Metadata> {
  const { path } = await params
  const resolved = await resolveRoute(path)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  if (resolved.type === 'services-index') {
    const title = 'All aesthetic services'
    const desc = 'Browse every aesthetic treatment we cover, from neurotoxins to fillers and skin therapies. Find verified, license-checked injectors near you.'
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc,
      alternates: { canonical: `${siteUrl}/services` },
      openGraph: { title, description: desc, url: `${siteUrl}/services`, images: DEFAULT_OG_IMAGES },
    }
  }

  if (resolved.type === 'brands-index') {
    const title = 'Aesthetic product brands'
    const desc = 'Browse aesthetic product brands: Botox, Juvederm, Dysport, Sculptra, and more. Find verified clinics that carry each brand.'
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc,
      alternates: { canonical: `${siteUrl}/brands` },
      openGraph: { title, description: desc, url: `${siteUrl}/brands`, images: DEFAULT_OG_IMAGES },
    }
  }

  if (resolved.type === 'brand-pillar') {
    const data = await getBrandPillar(resolved.brandSlug)
    if (!data) return {}
    const title = `${data.brand.name} Injectors Near You`
    const desc = `Find board-verified ${data.brand.name} injectors near you. Compare clinics, credentials, and pricing across the US. ${data.brand.tagline ?? ''}`
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc.trim(),
      alternates: { canonical: `${siteUrl}/brands/${resolved.brandSlug}` },
      ...(await getPageRobots(`/brands/${resolved.brandSlug}`)),
    }
  }

  if (resolved.type === 'brand-state') {
    const data = await getBrandState(resolved.brandSlug, resolved.stateSlug)
    if (!data) return {}
    const title = `${data.brand.name} in ${data.state.name}`
    return {
      title: { absolute: `${title} | injector.world` },
      description: `Find verified clinics carrying ${data.brand.name} in ${data.state.name}. Browse by city.`,
      alternates: { canonical: `${siteUrl}/brands/${resolved.brandSlug}/${resolved.stateSlug}` },
      ...(await getPageRobots(`/brands/${resolved.brandSlug}/${resolved.stateSlug}`)),
    }
  }

  if (resolved.type === 'brand-city-directory') {
    const data = await getBrandCityDirectory(resolved.brandSlug, resolved.stateSlug, resolved.citySlug)
    if (!data) return {}
    const city = data.city.name.replace(/\s+city$/i, '')
    const title = `${data.brand.name} in ${city}, ${data.city.stateCode}`
    const desc = `Find ${data.totalClinics > 0 ? data.totalClinics + ' ' : ''}verified clinics carrying ${data.brand.name} in ${city}. License-checked, patient-reviewed.`
    const canonical = `${siteUrl}/brands/${resolved.brandSlug}/${resolved.stateSlug}/${resolved.citySlug}`
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc,
      alternates: { canonical },
      openGraph: { title, description: desc, url: canonical, images: DEFAULT_OG_IMAGES },
      ...(await getPageRobots(canonical)),
    }
  }

  if (resolved.type === 'service-city-directory') {
    const data = await getCityDirectory(resolved.serviceSlug, resolved.stateSlug, resolved.citySlug)
    if (!data) return {}
    const city = data.city.name.replace(/\s+city$/i, '')
    const title = `${data.service.name} in ${city}, ${data.city.stateCode}`
    const desc = `Find ${data.totalClinics > 0 ? data.totalClinics + ' ' : ''}verified ${data.service.name} clinics in ${city}. License-checked, patient-reviewed.`
    const canonical = `${siteUrl}/services/${resolved.serviceSlug}/${resolved.stateSlug}/${resolved.citySlug}`
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc,
      alternates: { canonical },
      openGraph: { title, description: desc, url: canonical, images: DEFAULT_OG_IMAGES },
      ...(await getPageRobots(`/services/${resolved.serviceSlug}/${resolved.stateSlug}/${resolved.citySlug}`)),
    }
  }

  if (resolved.type === 'service-pillar') {
    const data = await getServicePillar(resolved.serviceSlug)
    if (!data) return {}
    const title = `${data.service.name} Injectors`
    const desc = `Find verified ${data.service.name} providers across the US. ${data.service.tagline ?? ''}`
    return {
      title: { absolute: `${title} | injector.world` },
      description: desc.trim(),
      alternates: { canonical: `${siteUrl}/services/${resolved.serviceSlug}` },
      ...(await getPageRobots(`/services/${resolved.serviceSlug}`)),
    }
  }

  if (resolved.type === 'service-state') {
    const data = await getServiceState(resolved.serviceSlug, resolved.stateSlug)
    if (!data) return {}
    const title = `${data.service.name} in ${data.state.name}`
    return {
      title: { absolute: `${title} | injector.world` },
      description: `Find verified ${data.service.name} providers in ${data.state.name}. Browse by city.`,
      alternates: { canonical: `${siteUrl}/services/${resolved.serviceSlug}/${resolved.stateSlug}` },
      ...(await getPageRobots(`/services/${resolved.serviceSlug}/${resolved.stateSlug}`)),
    }
  }

  return {}
}

export default async function CatchAllPage({
  params,
}: {
  params: Promise<{ path: string[] }>
}) {
  const { path } = await params
  const resolved = await resolveRoute(path)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

  // ── Brands index (/brands) ─────────────────────────────────────────────────
  if (resolved.type === 'brands-index') {
    const brands = await getBrandsIndex()
    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Brands', item: `${siteUrl}/brands` },
      ],
    }, {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: 'Aesthetic product brands',
      numberOfItems: brands.length,
      itemListElement: brands.map((b, i) => ({
        '@type': 'ListItem', position: i + 1, name: b.name, url: `${siteUrl}/brands/${b.slug}`,
      })),
    }]
    return <BrandsIndexPage brands={brands} schema={schema} />
  }

  // ── Brand pillar (/brands/[brand]) ─────────────────────────────────────────
  if (resolved.type === 'brand-pillar') {
    const data = await getBrandPillar(resolved.brandSlug)
    if (!data) notFound()
    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Brands', item: `${siteUrl}/brands` },
        { '@type': 'ListItem', position: 3, name: data.brand.name },
      ],
    }, ...(data.faqs.length > 0 ? [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: data.faqs.map((f) => ({
        '@type': 'Question', name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.detail ? `${f.answer} ${f.detail}` : f.answer },
      })),
    }] : [])]
    return <BrandPillarPage data={data} schema={schema} />
  }

  // ── Brand × state (/brands/[brand]/[state]) ────────────────────────────────
  if (resolved.type === 'brand-state') {
    const data = await getBrandState(resolved.brandSlug, resolved.stateSlug)
    if (!data) notFound()
    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Brands', item: `${siteUrl}/brands` },
        { '@type': 'ListItem', position: 3, name: data.brand.name, item: `${siteUrl}/brands/${resolved.brandSlug}` },
        { '@type': 'ListItem', position: 4, name: data.state.name },
      ],
    }]
    return <BrandStatePage data={data} schema={schema} />
  }

  // ── Brand × city (/brands/[brand]/[state]/[city]) ──────────────────────────
  if (resolved.type === 'brand-city-directory') {
    const data = await getBrandCityDirectory(resolved.brandSlug, resolved.stateSlug, resolved.citySlug)
    if (!data) notFound()
    const cityDisplay = data.city.name.replace(/\s+city$/i, '')
    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Brands', item: `${siteUrl}/brands` },
        { '@type': 'ListItem', position: 3, name: data.brand.name, item: `${siteUrl}/brands/${resolved.brandSlug}` },
        ...(data.stateLocation ? [{ '@type': 'ListItem', position: 4, name: data.stateLocation.name, item: `${siteUrl}/brands/${resolved.brandSlug}/${resolved.stateSlug}` }] : []),
        { '@type': 'ListItem', position: data.stateLocation ? 5 : 4, name: cityDisplay },
      ],
    }, ...(data.faqs.length > 0 ? [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: data.faqs.map((f) => ({
        '@type': 'Question', name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.detail ? `${f.answer} ${f.detail}` : f.answer },
      })),
    }] : [])]
    return <BrandCityDirectoryPage data={data} schema={schema} />
  }

  // ── Services index (/services) ──────────────────────────────────────────────
  if (resolved.type === 'services-index') {
    const services = await getServicesIndex()
    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'Services', item: `${siteUrl}/services` },
      ],
    }, {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: 'Aesthetic services',
      numberOfItems: services.length,
      itemListElement: services.map((s, i) => ({
        '@type': 'ListItem', position: i + 1, name: s.name, url: `${siteUrl}/services/${s.slug}`,
      })),
    }]
    return <ServicesIndexPage services={services} schema={schema} />
  }

  // ── Service × city directory (money page) ───────────────────────────────────
  if (resolved.type === 'service-city-directory') {
    const data = await getCityDirectory(resolved.serviceSlug, resolved.stateSlug, resolved.citySlug)
    if (!data) notFound()

    const banner = await getActiveBanner('service+city', data.service.id, undefined, data.city.id)

    const cityDisplay = data.city.name.replace(/\s+city$/i, '')

    const breadcrumbSchema = {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        ...(data.stateLocation ? [
          { '@type': 'ListItem', position: 2, name: data.service.name, item: `${siteUrl}/services/${resolved.serviceSlug}` },
          { '@type': 'ListItem', position: 3, name: `${data.service.name} in ${data.stateLocation.name}`, item: `${siteUrl}/services/${resolved.serviceSlug}/${data.stateLocation.slug}` },
        ] : []),
        { '@type': 'ListItem', position: data.stateLocation ? 4 : 2, name: data.city.name },
      ],
    }

    const clinicListSchema = data.clinics.length > 0 ? {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: `${data.service.name} clinics in ${cityDisplay}`,
      numberOfItems: data.clinics.length,
      itemListElement: data.clinics.slice(0, 10).map((c, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: { '@type': 'MedicalBusiness', name: c.clinicName, url: `${siteUrl}/clinics/${c.stateSlug}/${c.citySlug}/${c.slug}` },
      })),
    } : null

    const faqSchema = data.faqs.length > 0 ? {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: data.faqs.map((f) => ({
        '@type': 'Question', name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.detail ? `${f.answer} ${f.detail}` : f.answer },
      })),
    } : null

    return (
      <CityDirectoryPage
        data={data}
        banner={banner}
        schema={[breadcrumbSchema, ...(clinicListSchema ? [clinicListSchema] : []), ...(faqSchema ? [faqSchema] : [])]}
      />
    )
  }

  // ── Service pillar ───────────────────────────────────────────────────────────
  if (resolved.type === 'service-pillar') {
    const data = await getServicePillar(resolved.serviceSlug)
    if (!data) notFound()

    const banner = await getActiveBanner('service', data.service.id, undefined, undefined)

    const schema = [{
      '@context': 'https://schema.org', '@type': 'MedicalWebPage',
      name: `${data.service.name} Injectors`,
      description: data.service.shortDescription || data.service.tagline,
      url: `${siteUrl}/services/${resolved.serviceSlug}`,
      specialty: 'Dermatology',
    }, ...(data.faqs.length > 0 ? [{
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: data.faqs.map((f) => ({
        '@type': 'Question', name: f.question,
        acceptedAnswer: { '@type': 'Answer', text: f.detail ? `${f.answer} ${f.detail}` : f.answer },
      })),
    }] : [])]

    return <ServicePillarPage data={data} banner={banner} schema={schema} />
  }

  // ── Service × state ───────────────────────────────────────────────────────────
  if (resolved.type === 'service-state') {
    const data = await getServiceState(resolved.serviceSlug, resolved.stateSlug)
    if (!data) notFound()

    const banner = await getActiveBanner('service+state', data.service.id, data.state.id, undefined)

    const schema = [{
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: data.service.name, item: `${siteUrl}/services/${resolved.serviceSlug}` },
        { '@type': 'ListItem', position: 3, name: data.state.name },
      ],
    }, {
      '@context': 'https://schema.org', '@type': 'ItemList',
      name: `${data.service.name} providers in ${data.state.name}`,
      itemListElement: data.cities.map((c, i) => ({
        '@type': 'ListItem', position: i + 1,
        item: { '@type': 'City', name: c.name, url: `${siteUrl}/services/${resolved.serviceSlug}/${resolved.stateSlug}/${c.slug}` },
      })),
    }]

    return <ServiceStatePage data={data} banner={banner} schema={schema} />
  }

  notFound()
}
