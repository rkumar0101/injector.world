import type { Metadata } from 'next'
import { staticPageMetadata } from '@/lib/seo-metadata'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ProtectedEmail } from '@/components/shared/ProtectedEmail'

export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata(
    '/editorial-standards',
    'Editorial Standards | injector.world',
    'How injector.world creates, reviews, and updates content. Our independence policy, medical review process, and corrections log.',
  )
}

export default function EditorialStandardsPage() {
  return (
    <>
      <Header />

      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <span className="text-ink-primary">Editorial standards</span>
          </nav>
        </div>
      </div>

      <section className="bg-surface-warm pt-12 pb-10">
        <div className="max-canvas max-w-3xl">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-4 block">
            Transparency
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            Editorial standards
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-ink-secondary">
            How we make content, who reviews it, how we handle errors, and what we will never do.
          </p>
        </div>
      </section>

      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas max-w-3xl prose-guide space-y-12">

          <div>
            <h2>Who writes the content</h2>
            <p>All guides, articles, and editorial pieces are written by staff writers and freelance contributors with backgrounds in health journalism, aesthetic medicine, or patient advocacy. No content is published without a human author byline. AI-assisted drafts are never published without substantial human editing and fact-checking.</p>
          </div>

          <div>
            <h2>Medical review process</h2>
            <p>All treatment guides and medical content are reviewed by at least one member of our medical advisory board before publication. Reviewers are board-certified physicians or licensed providers with relevant clinical expertise. The reviewer's name and credentials are displayed on each article.</p>
            <p>Medical reviewers check for clinical accuracy, completeness of risk disclosures, and alignment with current clinical guidelines. They do not have editorial control over tone, structure, or conclusions.</p>
            <p>Every guide shows the date it was first published and, once its content has changed, the date it was last updated. Core treatment guides are reviewed at minimum every 12 months. Content is updated sooner when clinical guidelines change or new evidence emerges.</p>
          </div>

          <div>
            <h2>Sources and citations</h2>
            <p>We cite primary sources: peer-reviewed journal articles, FDA label information, clinical guidelines, and official medical society publications. We link to original sources wherever possible. We do not cite press releases, brand-owned content, or sponsored research without clearly labeling it as such.</p>
          </div>

          <div>
            <h2>Independence policy</h2>
            <p>injector.world is independently owned. Our editorial rankings and Editor's Pick selections are never paid for. A provider cannot influence their position in our directory or in our editorial content through advertising, sponsorship, or any other financial relationship.</p>
            <p>Sponsored listings exist on the platform and are clearly labeled "Sponsored" on every page where they appear. Sponsored slots are sold separately from editorial content and have no influence on our verification status, ratings, or rankings.</p>
            <p>Editorial staff do not know which providers have purchased sponsored slots. Commercial and editorial teams operate independently.</p>
          </div>

          <div>
            <h2>Corrections and updates</h2>
            <p>We correct factual errors promptly. When we correct an error in a published article, we note the correction at the bottom of the article with a brief description of what changed and the date. We do not silently edit errors.</p>
            <p>For significant corrections (clinical errors that could have affected patient decisions), we also note them in the corrections log below.</p>
          </div>

          <div id="corrections" className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="font-serif text-h3 text-ink-primary mb-3">Corrections log</h2>
            <p className="text-body-sm text-ink-secondary">
              No corrections have been logged yet. This log will record all significant corrections to published content as they occur.
            </p>
          </div>

          <div>
            <h2>Contact editorial</h2>
            <p>To report a factual error, suggest a correction, or raise an editorial concern: <ProtectedEmail user="editorial" /></p>
          </div>

          <div className="flex flex-wrap gap-4 pt-4 border-t border-border">
            <Link href="/how-we-verify" className="flex items-center gap-1.5 text-body-sm text-brand-accent font-medium hover:underline">
              How we verify providers
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
            <Link href="/medical-advisory" className="flex items-center gap-1.5 text-body-sm text-brand-accent font-medium hover:underline">
              Medical advisory board
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
