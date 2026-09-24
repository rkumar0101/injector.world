import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { CountPill } from '@/components/shared/CountPill'
import { getFaqHub, getFaqSettings } from '@/lib/faqs/queries'
import { getPageRobots } from '@/lib/page-index/queries'
import { buildPageMetadata } from '@/lib/seo-metadata'

/**
 * /faq: every FAQ category that has at least one approved question, grouped by
 * type. Replaced /questions on 2026-09-13; see docs/FAQ-SYSTEM-2026-09-13.md.
 * Turned off entirely from the FAQ settings panel (hubEnabled).
 */
export const revalidate = 300

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getFaqSettings()
  if (!settings.hubEnabled) return {}
  const title = `${settings.hubTitle} | injector.world`
  const description = settings.hubMetaDescription || settings.hubIntro
  // buildPageMetadata (2026-09-25): og:image, og:type and og:site_name were
  // missing. Title, description, canonical and robots are unchanged.
  return buildPageMetadata({ title, description, url: `${siteUrl}/faq`, imageAlt: title, robots: await getPageRobots('/faq') })
}

export default async function FaqHubPage() {
  const hub = await getFaqHub()
  if (!hub) notFound()

  const schema = [
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
        { '@type': 'ListItem', position: 2, name: 'FAQ' },
      ],
    },
    {
      '@context': 'https://schema.org',
      '@type': 'ItemList',
      name: hub.settings.hubTitle,
      numberOfItems: hub.totalCategories,
      itemListElement: hub.groups
        .flatMap((g) => g.categories)
        .map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: `${c.name} FAQs`, url: `${siteUrl}/faq/${c.slug}` })),
    },
  ]

  return (
    <>
      {schema.map((s, i) => (
        <script key={i} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(s).replace(/</g, '\\u003c') }} />
      ))}

      <Header />

      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <span className="text-ink-primary">FAQ</span>
          </nav>
        </div>
      </div>

      <section className="bg-surface-warm border-b border-border pb-8 pt-8 md:pb-10 md:pt-10">
        <div className="max-canvas max-w-4xl">
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">
            {hub.settings.hubTitle}
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-ink-secondary">{hub.settings.hubIntro}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <CountPill count={hub.totalQuestions} label="questions" />
          </div>
          {hub.groups.length > 1 && (
            <nav aria-label="FAQ groups" className="mt-6 flex flex-wrap gap-2">
              {hub.groups.map((g) => (
                <a
                  key={g.type}
                  href={`#${g.type}`}
                  className="rounded-control border border-border bg-surface-canvas px-3 py-1.5 text-body-sm text-ink-secondary transition hover:border-ink-primary hover:text-ink-primary"
                >
                  {g.label}
                </a>
              ))}
            </nav>
          )}
        </div>
      </section>

      <div className="section-pad bg-surface-canvas">
        <div className="max-canvas space-y-14">
          {hub.groups.map((g) => (
            <section key={g.type} id={g.type} className="scroll-mt-28">
              <h2 className="font-serif text-h2-m md:text-h2 text-ink-primary mb-5">{g.label}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 md:gap-4">
                {g.categories.map((c) => (
                  <Link
                    key={c.id}
                    href={`/faq/${c.slug}`}
                    className="group flex items-center justify-between gap-4 rounded-control border border-border bg-surface p-5 transition-all duration-200 hover:-translate-y-[2px] hover:border-ink-primary hover:shadow-hover"
                  >
                    <span className="font-serif text-h3-m md:text-h3 leading-snug text-ink-primary">{c.name}</span>
                    <span className="flex-shrink-0 text-caption text-ink-tertiary">
                      {c.count} question{c.count === 1 ? '' : 's'}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          ))}

          <p className="max-w-3xl text-body-sm text-ink-tertiary">
            These answers are general information written by our editorial team, not medical advice. Talk to a licensed
            provider about your own situation. How we write and review content:{' '}
            <Link href="/editorial-standards" className="underline underline-offset-4 hover:text-ink-primary">
              editorial standards
            </Link>
            .
          </p>
        </div>
      </div>

      <Footer />
    </>
  )
}
