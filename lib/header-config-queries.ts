import { cache } from 'react'
import { getPayloadInstance } from './payload-server'

export type HeaderNavItem = { label: string; href: string }

// NOTE: no `guides` here on purpose. The header links straight to /guides as a
// single item (2026-09-05), so HeaderConfig.featuredGuides is no longer read.
// The field is still on the global so no schema migration is needed; it just
// has no effect on the header.
export type HeaderNavData = {
  services: HeaderNavItem[]
  locations: HeaderNavItem[]
  brands: HeaderNavItem[]
  clinics: HeaderNavItem[]
}

// ─── Fallback defaults (used until admin configures Header Editor) ─────────────

const FALLBACK_SERVICES: HeaderNavItem[] = [
  { label: 'Lip Filler', href: '/services/lip-filler' },
  { label: 'Cheek Filler', href: '/services/cheek-filler' },
  { label: 'Jawline Filler', href: '/services/jawline-filler' },
  { label: 'Tear Trough Filler', href: '/services/tear-trough' },
  { label: 'Masseter Botox', href: '/services/masseter-botox' },
  { label: 'Forehead Botox', href: '/services/forehead-botox' },
  { label: 'Thread Lift', href: '/services/thread-lift' },
  { label: 'Microneedling', href: '/services/microneedling' },
  { label: 'PRP', href: '/services/prp' },
  { label: 'Brow Lift', href: '/services/brow-lift' },
]

// NOTE: if the admin has already saved a HeaderConfig global with featuredLocations
// pointing at the old unsuffixed city slugs, those saved links persist regardless of
// this fallback fix -- the admin must re-save the Header Editor to pick up correct slugs.
const FALLBACK_LOCATIONS: HeaderNavItem[] = [
  { label: 'New York City', href: '/services/botox/new-york/new-york-city-ny' },
  { label: 'Los Angeles', href: '/services/botox/california/los-angeles-ca' },
  { label: 'Miami', href: '/services/botox/florida/miami-fl' },
  { label: 'Houston', href: '/services/botox/texas/houston-tx' },
  { label: 'Chicago', href: '/services/botox/illinois/chicago-il' },
  { label: 'Dallas', href: '/services/botox/texas/dallas-tx' },
  { label: 'Austin', href: '/services/botox/texas/austin-tx' },
  { label: 'San Francisco', href: '/services/botox/california/san-francisco-ca' },
  { label: 'Atlanta', href: '/services/botox/georgia/atlanta-ga' },
  { label: 'Seattle', href: '/services/botox/washington/seattle-wa' },
  { label: 'California', href: '/services/botox/california' },
  { label: 'New York', href: '/services/botox/new-york' },
  { label: 'Florida', href: '/services/botox/florida' },
  { label: 'Texas', href: '/services/botox/texas' },
  { label: 'Illinois', href: '/services/botox/illinois' },
  { label: 'Colorado', href: '/services/botox/colorado' },
  { label: 'Georgia', href: '/services/botox/georgia' },
  { label: 'Arizona', href: '/services/botox/arizona' },
  { label: 'Washington', href: '/services/botox/washington' },
  { label: 'Massachusetts', href: '/services/botox/massachusetts' },
]

/**
 * State links for the Clinics accordion, added 2026-09-09 when the location
 * tree consolidated under /clinics.
 *
 * The ten largest states by city count, measured 2026-09-07. Ten matches what
 * every other section carries.
 *
 * These are a fallback, same as the lists above: when the admin has saved
 * featuredLocations in the Header Editor, the state rows in it win. There is no
 * separate `featuredClinicStates` field on HeaderConfig, deliberately -- adding
 * one is a schema change, and featuredLocations already holds exactly the state
 * rows this section needs.
 */
const FALLBACK_CLINIC_STATES: HeaderNavItem[] = [
  { label: 'California', href: '/clinics/california' },
  { label: 'New York', href: '/clinics/new-york' },
  { label: 'New Jersey', href: '/clinics/new-jersey' },
  { label: 'Pennsylvania', href: '/clinics/pennsylvania' },
  { label: 'Texas', href: '/clinics/texas' },
  { label: 'Ohio', href: '/clinics/ohio' },
  { label: 'Florida', href: '/clinics/florida' },
  { label: 'Illinois', href: '/clinics/illinois' },
  { label: 'Massachusetts', href: '/clinics/massachusetts' },
  { label: 'Michigan', href: '/clinics/michigan' },
]

const FALLBACK_BRANDS: HeaderNavItem[] = [
  { label: 'Botox', href: '/brands/botox' },
  { label: 'Dysport', href: '/brands/dysport' },
  { label: 'Xeomin', href: '/brands/xeomin' },
  { label: 'Daxxify', href: '/brands/daxxify' },
  { label: 'Juvederm', href: '/brands/juvederm' },
  { label: 'Restylane', href: '/brands/restylane' },
  { label: 'Sculptra', href: '/brands/sculptra' },
  { label: 'Radiesse', href: '/brands/radiesse' },
  { label: 'Kybella', href: '/brands/kybella' },
]

// ─── State code → slug map ────────────────────────────────────────────────────

async function getStateCodeToSlug(payload: any): Promise<Map<string, string>> {
  try {
    const res = await payload.find({
      collection: 'locations',
      where: { kind: { equals: 'state' } },
      limit: 60,
      depth: 0,
    })
    const map = new Map<string, string>()
    for (const s of res.docs as any[]) {
      if (s.state) map.set(String(s.state).toUpperCase(), s.slug as string)
    }
    return map
  } catch {
    return new Map()
  }
}

// ─── Main query ───────────────────────────────────────────────────────────────

export const getHeaderNavData = cache(async function getHeaderNavData(): Promise<HeaderNavData> {
  try {
    const payload = await getPayloadInstance()
    const [config, stateCodeToSlug]: [any, Map<string, string>] = await Promise.all([
      payload.findGlobal({ slug: 'header-config', depth: 1 }).catch(() => null as any),
      getStateCodeToSlug(payload),
    ])

    if (!config) return { services: FALLBACK_SERVICES, locations: FALLBACK_LOCATIONS, brands: FALLBACK_BRANDS, clinics: FALLBACK_CLINIC_STATES }

    // ── Services ────────────────────────────────────────────────────────────
    const services: HeaderNavItem[] =
      Array.isArray((config as any).featuredServices) && (config as any).featuredServices.length > 0
        ? (config as any).featuredServices
            .filter((s: any) => s && typeof s === 'object' && s.name && s.slug)
            .map((s: any) => ({ label: s.name as string, href: `/services/${s.slug}` }))
        : FALLBACK_SERVICES

    // ── Locations ───────────────────────────────────────────────────────────
    const locations: HeaderNavItem[] =
      Array.isArray((config as any).featuredLocations) && (config as any).featuredLocations.length > 0
        ? (config as any).featuredLocations
            .filter((l: any) => l && typeof l === 'object' && l.name && l.slug)
            .map((l: any) => {
              const isState = l.kind === 'state'
              if (isState) return { label: l.name as string, href: `/services/botox/${l.slug}` }
              const stateSlug = stateCodeToSlug.get(String(l.state ?? '').toUpperCase()) ?? String(l.state ?? '').toLowerCase()
              return { label: l.name as string, href: `/services/botox/${stateSlug}/${l.slug}` }
            })
        : FALLBACK_LOCATIONS

    // ── Brands ──────────────────────────────────────────────────────────────
    const brands: HeaderNavItem[] =
      Array.isArray((config as any).featuredBrands) && (config as any).featuredBrands.length > 0
        ? (config as any).featuredBrands
            .filter((b: any) => b && typeof b === 'object' && b.name && b.slug)
            .map((b: any) => ({ label: b.name as string, href: `/brands/${b.slug}` }))
        : FALLBACK_BRANDS

    // ── Clinics (state hubs) ────────────────────────────────────────────────
    // Reuses featuredLocations rather than a new global field: the state rows in
    // it are exactly this list, just pointed at /clinics/<slug> instead of at
    // /services/botox/<slug>. City rows are skipped, since a city hub url needs
    // its parent state slug and this section is state level.
    const configuredClinicStates: HeaderNavItem[] = Array.isArray((config as any).featuredLocations)
      ? (config as any).featuredLocations
          .filter((l: any) => l && typeof l === 'object' && l.name && l.slug && l.kind === 'state')
          .map((l: any) => ({ label: l.name as string, href: `/clinics/${l.slug}` }))
      : []
    const clinics = configuredClinicStates.length > 0 ? configuredClinicStates : FALLBACK_CLINIC_STATES

    return { services, locations, brands, clinics }
  } catch {
    return { services: FALLBACK_SERVICES, locations: FALLBACK_LOCATIONS, brands: FALLBACK_BRANDS, clinics: FALLBACK_CLINIC_STATES }
  }
})
