import { notFound, permanentRedirect } from 'next/navigation'
import { resolveRoute } from '@/lib/route-resolver'

/**
 * `/clinics/<state>/<city>` is not a page either. Same reasoning as the state
 * level one directory up: the Find path owns `/<state>/<city>`, so this is a
 * permanent (308) redirect into it, validated against the locations table so
 * that junk slugs keep 404ing instead of redirecting into a 404.
 */
export const revalidate = 600

export default async function ClinicsCityRedirect({
  params,
}: {
  params: Promise<{ state: string; city: string }>
}) {
  const { state, city } = await params

  const route = await resolveRoute([state, city])
  if (route.type !== 'city-hub') notFound()

  permanentRedirect(`/${route.stateSlug}/${route.citySlug}`)
}
