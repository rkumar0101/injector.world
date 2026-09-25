import type { Metadata } from 'next'
import { staticPageMetadata } from '@/lib/seo-metadata'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ProtectedEmail } from '@/components/shared/ProtectedEmail'

export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata(
    '/press',
    'Press | injector.world',
    'Press inquiries, media kit, and coverage of injector.world. Contact our communications team.',
  )
}

export default function PressPage() {
  return (
    <>
      <Header />

      <section className="bg-surface-warm pt-12 pb-10 md:pt-16 md:pb-12">
        <div className="max-canvas max-w-3xl">
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            Press
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-ink-secondary">
            Media inquiries, coverage requests, and resources for journalists.
          </p>
        </div>
      </section>

      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas max-w-3xl prose-guide space-y-10">

          <div>
            <h2>About injector.world</h2>
            <p>injector.world is an independent directory and editorial guide to aesthetic injectors in the United States. We license-verify every provider on the platform and publish medically reviewed treatment guides written by health journalists. We do not sell rankings or accept editorial payment from providers.</p>
          </div>

          <div>
            <h2>For press inquiries</h2>
            <p>We welcome coverage requests, interview inquiries, and data licensing for editorial use. Please reach out to our communications team directly.</p>
            <p>
              Email:{' '}
              <ProtectedEmail user="press" className="text-brand-accent hover:underline" />
            </p>
            <p className="text-body-sm text-ink-secondary mt-2">We aim to respond to all press inquiries within one business day.</p>
          </div>

          <div>
            <h2>Data and research</h2>
            <p>Our database covers over 12,000 verified injectors across 50 states. Journalists covering the aesthetics market, healthcare, or consumer trends are welcome to request aggregated data for editorial coverage. We can also arrange on-record quotes from our editorial team.</p>
          </div>

          <div>
            <h2>Media kit</h2>
            <p>A full media kit including company overview, statistics, and logo files is available on request. Email <ProtectedEmail user="press" className="text-brand-accent hover:underline" /> with "media kit" in the subject line.</p>
          </div>

          <div className="flex flex-wrap gap-4 pt-6 border-t border-border">
            <Link href="/about" className="flex items-center gap-1.5 text-body-sm text-brand-accent font-medium hover:underline">
              About us
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
            <Link href="/editorial-standards" className="flex items-center gap-1.5 text-body-sm text-brand-accent font-medium hover:underline">
              Editorial standards
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
            <Link href="/contact" className="flex items-center gap-1.5 text-body-sm text-brand-accent font-medium hover:underline">
              Contact
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
