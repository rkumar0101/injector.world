import type { Metadata } from 'next'
import { staticPageMetadata } from '@/lib/seo-metadata'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ProtectedEmail } from '@/components/shared/ProtectedEmail'

export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata(
    '/careers',
    'Careers | injector.world',
    'Open roles at injector.world. We are building the trusted guide to aesthetic injectors in the United States.',
  )
}

export default function CareersPage() {
  return (
    <>
      <Header />

      <section className="bg-surface-warm pt-12 pb-10 md:pt-16 md:pb-12">
        <div className="max-canvas max-w-3xl">
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            Careers
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-ink-secondary">
            We are building an independent, trustworthy guide to aesthetic medicine in the US. If that sounds like work worth doing, we want to hear from you.
          </p>
        </div>
      </section>

      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas max-w-3xl prose-guide space-y-10">

          <div>
            <h2>What we are building</h2>
            <p>injector.world is a content-led directory for aesthetic injectors. We verify every provider's license, write treatment guides that are actually useful, and give patients the information they need to make a good decision. No influencer-speak.</p>
            <p>We are an early-stage company operating lean and moving fast. Everyone here does work that matters directly to the product.</p>
          </div>

          <div>
            <h2>Open roles</h2>
            <p>We do not have open roles listed publicly right now. We hire selectively and move quickly when we find the right person.</p>
            <p>If you are a strong writer, engineer, or designer who cares about healthcare information quality, email us. Tell us what you would work on and why.</p>
          </div>

          <div>
            <h2>What we look for</h2>
            <ul>
              <li>Health journalists and editors with experience in medical or consumer health content</li>
              <li>Full-stack engineers comfortable with Next.js, PostgreSQL, and modern TypeScript</li>
              <li>Product and growth people who have worked in health, media, or local services</li>
              <li>Medical writers and researchers with a track record in evidence-based content</li>
            </ul>
          </div>

          <div>
            <h2>How to reach us</h2>
            <p>
              Email:{' '}
              <ProtectedEmail user="careers" className="text-brand-accent hover:underline" />
            </p>
            <p className="text-body-sm text-ink-secondary mt-2">Include your background, what you would work on, and links to relevant work. No recruiters or agencies, please.</p>
          </div>

          <div className="flex flex-wrap gap-4 pt-6 border-t border-border">
            <Link href="/about" className="flex items-center gap-1.5 text-body-sm text-brand-accent font-medium hover:underline">
              About us
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
