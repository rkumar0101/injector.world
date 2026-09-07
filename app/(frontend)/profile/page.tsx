import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { getAuthUser } from '@/lib/auth-user'
import { getLocationSlugMap, lookupSlugs } from '@/lib/location-slug-lookup'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ProfileClient } from '@/components/account/ProfileClient'
import type { ProfileData } from '@/components/account/ProfileClient'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: { absolute: 'Your profile | injector.world' },
  description: 'Your saved clinics, consult requests, questions, and account settings.',
  robots: 'noindex',
}

function relIds(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const out: number[] = []
  for (const v of value) {
    const n = typeof v === 'object' && v !== null ? Number((v as { id?: unknown }).id) : Number(v)
    if (Number.isFinite(n)) out.push(n)
  }
  return out
}

export default async function ProfilePage() {
  const payload = await getPayload({ config })
  const user = await getAuthUser(payload)

  if (!user) redirect('/login?redirect=/profile')
  // Staff have their own homes; /profile is the user surface.
  const role = (user as { role?: string }).role
  if (role === 'admin' || role === 'editor') redirect('/admin')

  const u = user as unknown as Record<string, unknown>
  const savedClinicIds = relIds(u.savedClinics)

  // Saved clinics
  //
  // The href is built here, not in the client component. A clinic url is
  // /clinics/[state]/[city]/[slug] and the clinic row only carries the raw
  // city/state names, so the slugs have to come from the locations map, which
  // is server-side. ProfileClient used to link to `/clinics/<slug>` on its own:
  // a two-segment url that matched no route, so every saved clinic 404'd.
  // Mirrors the pattern already in app/(frontend)/dashboard/page.tsx.
  const slugMap = savedClinicIds.length > 0 ? await getLocationSlugMap() : null
  const savedClinics =
    savedClinicIds.length > 0
      ? (
          await payload.find({
            collection: 'clinics',
            where: { id: { in: savedClinicIds } },
            depth: 0,
            limit: 100,
            overrideAccess: true,
          })
        ).docs.map((c) => {
          const d = c as unknown as Record<string, unknown>
          const loc = [d.city, d.state].filter(Boolean).join(', ')
          const slug = (d.slug as string) || ''
          const slugs = slugMap
            ? lookupSlugs(String(d.city ?? ''), String(d.state ?? ''), slugMap)
            : null
          return {
            id: String(d.id),
            name: (d.clinicName as string) || 'Clinic',
            slug,
            location: loc,
            href:
              slug && slugs?.stateSlug && slugs?.citySlug
                ? `/clinics/${slugs.stateSlug}/${slugs.citySlug}/${slug}`
                : null,
          }
        })
      : []

  // Consult history (bookings tied to this account's email).
  const bookingsRes = await payload.find({
    collection: 'bookings',
    where: { patientEmail: { equals: user.email } },
    depth: 1,
    limit: 50,
    sort: '-createdAt',
    overrideAccess: true,
  })
  const bookings = bookingsRes.docs.map((b) => {
    const d = b as unknown as Record<string, unknown>
    return {
      id: String(d.id),
      service: (d.serviceTag as string) || '',
      preferredDate: (d.preferredDate as string) || '',
      status: (d.status as string) || 'new',
      createdAt: (d.createdAt as string) || '',
    }
  })

  // Questions this account submitted.
  const questionsRes = await payload.find({
    collection: 'qa',
    where: { submitterEmail: { equals: user.email } },
    depth: 0,
    limit: 50,
    sort: '-createdAt',
    overrideAccess: true,
  })
  const questions = questionsRes.docs.map((q) => {
    const d = q as unknown as Record<string, unknown>
    const answered = d.status === 'answered'
    return {
      id: String(d.id),
      title: (d.questionTitle as string) || 'Question',
      status: (d.status as string) || 'new',
      slug: (d.slug as string) || '',
      answered,
    }
  })

  // Quiz recommendation (treatment slug) -> name + link.
  let recommended: ProfileData['recommended'] = null
  const quizSlug = (u.quizRecommendation as string) || ''
  if (quizSlug) {
    const tRes = await payload.find({
      collection: 'services',
      where: { slug: { equals: quizSlug } },
      depth: 0,
      limit: 1,
      overrideAccess: true,
    })
    const t = tRes.docs[0] as unknown as Record<string, unknown> | undefined
    if (t) {
      recommended = {
        name: (t.name as string) || quizSlug,
        slug: (t.slug as string) || quizSlug,
      }
    }
  }

  const data: ProfileData = {
    user: { name: (u.name as string) || '', email: user.email },
    savedClinics,
    bookings,
    questions,
    recommended,
  }

  return (
    <>
      <Header />
      <main className="min-h-[60vh] bg-surface-canvas">
        <ProfileClient data={data} />
      </main>
      <Footer />
    </>
  )
}

