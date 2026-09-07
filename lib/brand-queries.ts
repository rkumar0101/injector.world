import { cache } from 'react'
import { getPayloadInstance } from './payload-server'
import { getLocationSlugMap, lookupSlugs } from './location-slug-lookup'
import { getAnsweredQAs, type QAItem } from './qa-queries'
import { mapClinic, type DirectoryClinic, type LocationInfo, type FaqRow } from './location-queries'
import { fetchLeanClinics, leanRowToMapClinicInput } from './lean-clinic-listing'

// ─── Types ────────────────────────────────────────────────────────────────────

export type BrandInfo = {
  id: string
  name: string
  slug: string
  manufacturer?: string
  category: string
  tagline?: string
  shortDescription?: string
  iconSlug?: string
  guide: { title: string; slug: string; lede: string } | null
  avgPriceFromUsd?: number
  avgPriceToUsd?: number
  priceUnit?: string
  longevityLabel?: string
  downtimeLabel?: string
  websiteUrl?: string
  logoUrl?: string
}

export type BrandIndexEntry = {
  id: string
  name: string
  slug: string
  category: string
  tagline?: string
  clinicCount: number
}

export type BrandStateEntry = { code: string; name: string; slug: string }

export type BrandCityEntry = {
  name: string
  slug: string
  clinicCount: number
  stateCode: string
  stateSlug: string
}

export type BrandPillarData = {
  brand: BrandInfo
  topClinics: DirectoryClinic[]
  states: BrandStateEntry[]
  allCities: BrandCityEntry[]
  relatedServices: Array<{ id: string; name: string; slug: string }>
  faqs: FaqRow[]
  totalClinics: number
}

export type BrandStateData = {
  brand: BrandInfo
  state: LocationInfo
  cities: BrandCityEntry[]
  clinics: DirectoryClinic[]
  relatedServices: Array<{ id: string; name: string; slug: string }>
  faqs: FaqRow[]
  totalClinics: number
}

export type BrandCityData = {
  brand: BrandInfo
  city: LocationInfo
  stateLocation: LocationInfo | null
  clinics: DirectoryClinic[]
  relatedServices: Array<{ id: string; name: string; slug: string }>
  faqs: FaqRow[]
  totalClinics: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapBrand(b: any): BrandInfo {
  return {
    id: String(b.id),
    name: b.name,
    slug: b.slug,
    manufacturer: b.manufacturer ?? undefined,
    category: b.category ?? '',
    tagline: b.tagline ?? undefined,
    shortDescription: b.shortDescription ?? undefined,
    iconSlug: b.iconSlug ?? undefined,
    guide:
      b.guide && typeof b.guide === 'object'
        ? { title: b.guide.title, slug: b.guide.slug, lede: b.guide.lede }
        : null,
    avgPriceFromUsd: b.avgPriceFromUsd ?? undefined,
    avgPriceToUsd: b.avgPriceToUsd ?? undefined,
    priceUnit: b.priceUnit ?? undefined,
    longevityLabel: b.longevityLabel ?? undefined,
    downtimeLabel: b.downtimeLabel ?? undefined,
    websiteUrl: b.websiteUrl ?? undefined,
    logoUrl: b.logoUrl ?? undefined,
  }
}

function mapLocation(c: any, stateCodeOverride?: string) {
  return {
    id: String(c.id),
    name: c.name ?? '',
    slug: c.slug,
    kind: c.kind ?? '',
    stateCode: stateCodeOverride ?? c.state ?? '',
    latitude: c.latitude ?? undefined,
    longitude: c.longitude ?? undefined,
    providerCount: c.providerCount ?? 0,
    isLive: c.isLive === true,
    noindex: c.noindex !== false,
  }
}

function mapFaqDocs(docs: any[]): FaqRow[] {
  return docs.map((f: any) => ({
    id: String(f.id),
    question: f.question,
    answer: f.answer,
    detail: f.answerDetail || undefined,
    offLabel: !!f.offLabel,
    safetyFlag: f.safetyFlag || undefined,
    relatedGuideSlug: f.relatedGuide && typeof f.relatedGuide === 'object' ? f.relatedGuide.slug : undefined,
    relatedGuideTitle: f.relatedGuide && typeof f.relatedGuide === 'object' ? f.relatedGuide.title : undefined,
  }))
}

async function findFaqs(payload: any, where: any[]): Promise<any[]> {
  const res = await payload.find({
    collection: 'faqs',
    where: { and: [...where, { reviewStatus: { equals: 'approved' } }] },
    limit: 8,
    sort: 'sortRank',
    depth: 1,
  })
  return res.docs
}

/** Brand pillar/state pages: brand-tagged FAQs, optionally overridden per state with a fallback to the state-agnostic set. */
async function getBrandFaqs(payload: any, brandId: number, stateLocationId?: number): Promise<FaqRow[]> {
  if (stateLocationId) {
    const scoped = await findFaqs(payload, [{ scope: { equals: 'brand' } }, { brand: { equals: brandId } }, { location: { equals: stateLocationId } }])
    if (scoped.length > 0) return mapFaqDocs(scoped)
  }
  const general = await findFaqs(payload, [{ scope: { equals: 'brand' } }, { brand: { equals: brandId } }, { location: { exists: false } }])
  return mapFaqDocs(general)
}

/** Brand + city combined pages (the BRAND path's most specific level): a location-tagged FAQ narrowed to one brand. */
async function getBrandCityFaqs(payload: any, brandId: number, locationId: number): Promise<FaqRow[]> {
  const docs = await findFaqs(payload, [{ scope: { equals: 'location' } }, { location: { equals: locationId } }, { brand: { equals: brandId } }])
  return mapFaqDocs(docs)
}

// ─── Brands index — /brands ───────────────────────────────────────────────────

export const getBrandsIndex = cache(async function getBrandsIndex(): Promise<BrandIndexEntry[]> {
  const payload = await getPayloadInstance()

  const [brandsRes, pool] = await Promise.all([
    payload.find({ collection: 'brands', limit: 500, depth: 0, sort: 'name' }),
    Promise.resolve((payload.db as any).pool),
  ])

  // Clinic count per brand via raw SQL for accuracy.
  const counts = new Map<string, number>()
  try {
    const r = await pool.query(
      `SELECT cr.brands_id AS bid, count(*)::int AS n
         FROM clinics c
         JOIN clinics_rels cr ON cr.parent_id = c.id AND cr.brands_id IS NOT NULL
        WHERE c.status = 'published'
        GROUP BY cr.brands_id`,
    )
    for (const row of r.rows) counts.set(String(row.bid), Number(row.n))
  } catch { /* counts stay 0 */ }

  return (brandsRes.docs as any[]).map((b) => ({
    id: String(b.id),
    name: b.name,
    slug: b.slug,
    category: b.category ?? '',
    tagline: b.tagline ?? undefined,
    clinicCount: counts.get(String(b.id)) ?? 0,
  }))
})

// ─── Brand pillar — /brands/[brand] ──────────────────────────────────────────

export const getBrandPillar = cache(async function getBrandPillar(brandSlug: string): Promise<BrandPillarData | null> {
  const payload = await getPayloadInstance()

  const brandRes = await payload.find({
    collection: 'brands',
    where: { slug: { equals: brandSlug } },
    limit: 1,
    depth: 2,
  })
  const b = brandRes.docs[0]
  if (!b) return null

  const pool = (payload.db as any).pool
  const [slugMap, topClinicsResult, statesRes, allCitiesRes, faqs, relatedServicesRes] = await Promise.all([
    getLocationSlugMap(),
    fetchLeanClinics(pool, { relFilter: { path: 'brandsOffered', id: b.id }, limit: 24, offset: 0 }),
    payload.find({ collection: 'locations', where: { kind: { equals: 'state' } }, limit: 60, sort: 'name', depth: 0 }),
    pool.query(
      `SELECT MIN(c.city) AS city, c.state, count(*)::int AS n
         FROM clinics c
         JOIN clinics_rels cr ON cr.parent_id = c.id AND cr.brands_id = $1
        WHERE c.status = 'published'
          AND c.city IS NOT NULL AND c.city <> ''
          AND c.state IS NOT NULL AND c.state <> ''
        GROUP BY lower(c.city), c.state
        ORDER BY count(*) DESC`,
      [b.id],
    ),
    getBrandFaqs(payload, b.id),
    payload.find({ collection: 'services', limit: 100, depth: 0, sort: 'name' }),
  ])

  // Total clinic count (same filter fetchLeanClinics already used, no need for a second query)
  const totalClinics = topClinicsResult.totalCount

  const stateSlugByCode = new Map<string, string>(
    (statesRes.docs as any[]).map((s: any) => [String(s.state ?? '').toUpperCase(), s.slug as string]),
  )

  const allCities: BrandCityEntry[] = (allCitiesRes.rows as any[])
    .map((c: any) => {
      const stateCode = String(c.state ?? '').toUpperCase()
      const slugs = lookupSlugs(c.city ?? '', stateCode, slugMap)
      if (!slugs.citySlug) return null
      return {
        name: c.city,
        slug: slugs.citySlug,
        clinicCount: Number(c.n ?? 0),
        stateCode,
        stateSlug: slugs.stateSlug || stateSlugByCode.get(stateCode) || '',
      }
    })
    .filter((c): c is BrandCityEntry => !!c && !!c.stateCode && !!c.stateSlug)

  const stateCodes = new Set(allCities.map((c) => c.stateCode))
  const states: BrandStateEntry[] = (statesRes.docs as any[])
    .map((s: any) => ({ code: String(s.state ?? '').toUpperCase(), name: s.name, slug: s.slug }))
    .filter((s) => s.code && stateCodes.has(s.code))

  const relatedServices = (relatedServicesRes.docs as any[]).map((s: any) => ({
    id: String(s.id),
    name: s.name,
    slug: s.slug,
  }))

  return {
    brand: mapBrand(b),
    topClinics: topClinicsResult.rows.map((row) => mapClinic(leanRowToMapClinicInput(row), slugMap)),
    states,
    allCities,
    relatedServices,
    faqs,
    totalClinics,
  }
})

// ─── Brand × state — /brands/[brand]/[state] ─────────────────────────────────

export const getBrandState = cache(async function getBrandState(
  brandSlug: string,
  stateSlug: string,
): Promise<BrandStateData | null> {
  const payload = await getPayloadInstance()

  const [brandRes, stateRes] = await Promise.all([
    payload.find({ collection: 'brands', where: { slug: { equals: brandSlug } }, limit: 1, depth: 0 }),
    payload.find({ collection: 'locations', where: { and: [{ slug: { equals: stateSlug } }, { kind: { equals: 'state' } }] }, limit: 1, depth: 0 }),
  ])

  const brand = brandRes.docs[0]
  const stateLoc = stateRes.docs[0]
  if (!brand || !stateLoc) return null

  const stateCode: string = stateLoc.state ?? ''
  const pool = (payload.db as any).pool

  const [citiesRes, faqs, clinicsRes, relatedServicesRes, slugMap] = await Promise.all([
    pool.query(
      `SELECT MIN(c.city) AS city, count(*)::int AS n
         FROM clinics c
         JOIN clinics_rels cr ON cr.parent_id = c.id AND cr.brands_id = $1
        WHERE c.status = 'published'
          AND upper(c.state) = $2
          AND c.city IS NOT NULL AND c.city <> ''
        GROUP BY lower(c.city)
        ORDER BY count(*) DESC`,
      [brand.id, stateCode.toUpperCase()],
    ),
    getBrandFaqs(payload, brand.id, stateLoc.id),
    payload.find({
      collection: 'clinics',
      where: {
        and: [
          { state: { equals: stateCode } },
          { status: { equals: 'published' } },
          { brandsOffered: { in: [brand.id] } },
        ],
      },
      limit: 24,
      page: 1,
      depth: 0,
      sort: '-aggregateRatingCount',
    }),
    payload.find({ collection: 'services', limit: 100, depth: 0, sort: 'name' }),
    getLocationSlugMap(),
  ])

  // Total clinics in this state with this brand
  let totalClinics = clinicsRes.totalDocs ?? clinicsRes.docs.length
  try {
    const r = await pool.query(
      `SELECT count(*)::int AS n FROM clinics c
         JOIN clinics_rels cr ON cr.parent_id = c.id AND cr.brands_id = $1
        WHERE c.status = 'published' AND upper(c.state) = $2`,
      [brand.id, stateCode.toUpperCase()],
    )
    totalClinics = Number(r.rows[0]?.n ?? 0)
  } catch { /* use totalDocs */ }

  const cities: BrandCityEntry[] = (citiesRes.rows as any[])
    .map((row: any) => {
      const slugs = lookupSlugs(row.city ?? '', stateCode, slugMap)
      if (!slugs.citySlug) return null
      return { name: row.city, slug: slugs.citySlug, clinicCount: Number(row.n ?? 0), stateCode, stateSlug: slugs.stateSlug || stateSlug }
    })
    .filter((c): c is BrandCityEntry => !!c)

  return {
    brand: mapBrand(brand),
    state: mapLocation(stateLoc, stateCode),
    cities,
    clinics: (clinicsRes.docs as any[]).map((c: any) => mapClinic(c, slugMap)),
    relatedServices: (relatedServicesRes.docs as any[]).map((s: any) => ({
      id: String(s.id),
      name: s.name,
      slug: s.slug,
    })),
    faqs,
    totalClinics,
  }
})

// ─── Brand × city — /brands/[brand]/[state]/[city] ───────────────────────────

export const getBrandCityDirectory = cache(async function getBrandCityDirectory(
  brandSlug: string,
  stateSlug: string,
  citySlug: string,
): Promise<BrandCityData | null> {
  const payload = await getPayloadInstance()

  const [brandRes, cityRes, stateRes] = await Promise.all([
    payload.find({ collection: 'brands', where: { slug: { equals: brandSlug } }, limit: 1, depth: 0 }),
    payload.find({ collection: 'locations', where: { and: [{ slug: { equals: citySlug } }, { kind: { in: ['city', 'metro'] } }] }, limit: 1, depth: 0 }),
    payload.find({ collection: 'locations', where: { and: [{ slug: { equals: stateSlug } }, { kind: { equals: 'state' } }] }, limit: 1, depth: 0 }),
  ])

  const brand = brandRes.docs[0]
  const cityLoc = cityRes.docs[0]
  if (!brand || !cityLoc) return null

  const stateLoc = stateRes.docs[0] ?? null
  const stateCode: string = (stateLoc as any)?.state ?? cityLoc.state ?? ''
  const cityName = (cityLoc.name as string).replace(/\s+city$/i, '').trim()
  const pool = (payload.db as any).pool

  const [slugMap, clinicsRes, relatedServicesRes, faqs] = await Promise.all([
    getLocationSlugMap(),
    payload.find({
      collection: 'clinics',
      where: {
        and: [
          // `equals`, not `like`. See the note in getCityHub
          // (lib/location-queries.ts): Payload's `like` is a substring ILIKE,
          // so a brand city page had the same cross-city bleed (Cleveland
          // showing Cleveland Heights clinics).
          { city: { equals: cityName } },
          { state: { equals: stateCode } },
          { status: { equals: 'published' } },
          { brandsOffered: { in: [brand.id] } },
        ],
      },
      limit: 24,
      page: 1,
      depth: 0,
      sort: '-aggregateRatingCount',
    }),
    payload.find({ collection: 'services', limit: 100, depth: 0, sort: 'name' }),
    getBrandCityFaqs(payload, brand.id, cityLoc.id),
  ])

  // Exact count for the brand+city+state combo -- the clinicsRes fetch above uses
  // a fuzzy `like` city match for the listing, which can over/under-count vs. an
  // exact join. This overrides the displayed number with an exact count.
  let totalClinics = clinicsRes.totalDocs ?? clinicsRes.docs.length
  try {
    const r = await pool.query(
      `SELECT count(*)::int AS n FROM clinics c
         JOIN clinics_rels cr ON cr.parent_id = c.id AND cr.brands_id = $1
        WHERE c.status = 'published' AND upper(c.city) = $2 AND upper(c.state) = $3`,
      [brand.id, cityName.toUpperCase(), stateCode.toUpperCase()],
    )
    totalClinics = Number(r.rows[0]?.n ?? totalClinics)
  } catch { /* use totalDocs fallback */ }

  const clinics: DirectoryClinic[] = (clinicsRes.docs as any[]).map((c: any) => mapClinic(c, slugMap))

  const relatedServices = (relatedServicesRes.docs as any[]).map((s: any) => ({
    id: String(s.id),
    name: s.name,
    slug: s.slug,
  }))

  return {
    brand: mapBrand(brand),
    city: {
      ...mapLocation(cityLoc, stateCode),
      providerCount: totalClinics,
    },
    stateLocation: stateLoc ? mapLocation(stateLoc, stateCode) : null,
    clinics,
    relatedServices,
    faqs,
    totalClinics,
  }
})

// ─── All brand slugs (for generateStaticParams) ───────────────────────────────

export async function getAllBrandSlugs(): Promise<string[]> {
  const payload = await getPayloadInstance()
  const res = await payload.find({ collection: 'brands', limit: 1000, depth: 0 })
  return res.docs.map((b: any) => b.slug).filter(Boolean)
}
