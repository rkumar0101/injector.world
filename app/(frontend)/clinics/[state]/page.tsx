import { notFound, permanentRedirect } from 'next/navigation'
import { resolveRoute } from '@/lib/route-resolver'

/**
 * `/clinics/<state>` is not a page. It 404'd until now, which wasted every
 * external link and every crawl of that shape.
 *
 * The Find path already owns the state hub at `/<state>`, so this segment is a
 * permanent (308) redirect into it rather than a second page. Building a real
 * page here would create two urls for one thing and a canonical conflict.
 *
 * The redirect is data-driven, which is why it lives here and not in
 * `next.config.mjs`: the set of valid state slugs comes from the locations
 * table and changes without a rebuild. A slug that is not a real state still
 * 404s, so junk urls do not get redirected into a 404.
 */
export const revalidate = 600

export default async function ClinicsStateRedirect({
  params,
}: {
  params: Promise<{ state: string }>
}) {
  const { state } = await params

  const route = await resolveRoute([state])
  if (route.type !== 'state-hub') notFound()

  permanentRedirect(`/${route.stateSlug}`)
}
