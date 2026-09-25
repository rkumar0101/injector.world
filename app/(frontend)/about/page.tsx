import type { Metadata } from 'next'
import { staticPageMetadata } from '@/lib/seo-metadata'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'

export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata(
    '/about',
    'About | injector.world',
    'injector.world is an independent guide to verified aesthetic injectors in the United States. Learn about our mission and how we work.',
  )
}

export default function AboutPage() {
  return (
    <>
      <Header />

      <section className="bg-surface-warm pt-12 pb-10 md:pt-16 md:pb-12">
        <div className="max-canvas max-w-3xl">
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            About injector.world
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-ink-secondary">
            An independent directory and editorial guide to aesthetic injectors in the United States.
          </p>
        </div>
      </section>

      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas max-w-3xl prose-guide space-y-10">

          <div>
            <h2>What we are</h2>
            <p>injector.world is a content-led directory. We combine two things: a license-verified database of aesthetic providers, and an independent editorial team that explains treatments in plain language. The goal is to give patients the information they need to make a good decision, not just a list of names.</p>
          </div>

          <div>
            <h2>Why we built this</h2>
            <p>The injectable market in the US is large and largely unregulated at the point of search. Patients looking for a Botox provider can end up on review platforms optimized for ads, directories that sell top placement, or clinic websites where every injector looks like the best option. None of these surfaces help a patient understand what questions to ask or how to evaluate a provider's credentials.</p>
            <p>We built injector.world to fill that gap. Every provider on the site has had their license checked. Every treatment guide was written by a health journalist and reviewed by a board-certified physician. Rankings are not for sale.</p>
          </div>

          <div>
            <h2>Independence</h2>
            <p>injector.world is independently owned and operated. We do not accept editorial payment from providers or clinics. Sponsored listing slots are available and clearly labeled "Sponsored" wherever they appear. Our editorial rankings, Editor's Pick selections, and treatment guides are not influenced by any commercial relationships.</p>
          </div>

          <div>
            <h2>Our standards</h2>
            <p>All medical content is reviewed by board-certified physicians before publication. Providers are verified against state license databases. Patient reviews are sourced from public platforms and our own moderated submissions. We publish a corrections log when we make significant changes to published content.</p>
          </div>

          <div className="flex flex-wrap gap-4 pt-6 border-t border-border">
            <Link href="/how-we-verify" className="flex items-center gap-1.5 text-body-sm text-brand-accent font-medium hover:underline">
              How we verify providers
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
            <Link href="/editorial-standards" className="flex items-center gap-1.5 text-body-sm text-brand-accent font-medium hover:underline">
              Editorial standards
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
            <Link href="/contact" className="flex items-center gap-1.5 text-body-sm text-brand-accent font-medium hover:underline">
              Contact us
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
