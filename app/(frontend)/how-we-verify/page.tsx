import type { Metadata } from 'next'
import { staticPageMetadata } from '@/lib/seo-metadata'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'

export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata(
    '/how-we-verify',
    'How We Verify Injectors | injector.world',
    'Every provider on injector.world is license-verified against the state medical board. Learn exactly how our verification process works.',
  )
}

const steps = [
  {
    number: '01',
    title: 'License verification',
    body: 'We check every injector against the state medical board where they hold their license. License number, license type, expiration date, and status are all confirmed. If a license is expired, inactive, or under disciplinary action, the provider is not listed.',
    detail: 'We use the same public license lookup databases that patients can access directly. Every verified license number is displayed on the provider profile with a link to the state database.',
  },
  {
    number: '02',
    title: 'Credential review',
    body: 'We verify the provider\'s claimed credentials. Board certifications, fellowship training, and advanced degrees are confirmed against the relevant certifying bodies (ABMS, ABPS, ABFPRS, etc.).',
    detail: 'Our team reviews profiles for providers claiming board certifications. Credentials shown on a profile are ones we have been able to independently confirm.',
  },
  {
    number: '03',
    title: 'Patient reviews',
    body: 'Reviews on injector.world are sourced from public platforms (Google, Healthgrades, Vitals, Zocdoc) and from our own moderated patient submissions. Providers cannot delete reviews about themselves.',
    detail: 'We flag reviews for manual review when they show patterns consistent with review manipulation. Fake positive reviews are removed. We do not remove negative reviews unless they violate our content policy.',
  },
  {
    number: '04',
    title: 'Rankings aren\'t for sale',
    body: 'Our editorial rankings are not for sale. A provider cannot pay to appear higher in the directory or in our Editor\'s Pick selections. Paid sponsored listings are structurally separate and labeled "Sponsored" on every page.',
    detail: 'This independence is the foundation of patient trust. If our rankings were pay-to-play, the entire directory would be worthless. We hold this standard across every metro and treatment category.',
  },
]

export default function HowWeVerifyPage() {
  return (
    <>
      <Header />

      <div className="bg-surface border-b border-border">
        <div className="max-canvas py-3">
          <nav className="flex items-center gap-2 text-caption text-ink-tertiary" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-ink-primary transition">Home</Link>
            <span>/</span>
            <span className="text-ink-primary">How we verify</span>
          </nav>
        </div>
      </div>

      <section className="bg-surface-warm pt-12 pb-10 md:pt-16 md:pb-12">
        <div className="max-canvas max-w-3xl">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-4 block">
            Trust and transparency
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            How we verify every injector
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-ink-secondary">
            Before a provider appears on injector.world, we verify their license, confirm their credentials, and check their review history. Here is exactly how.
          </p>
        </div>
      </section>

      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas max-w-3xl">
          <div className="space-y-14">
            {steps.map((step) => (
              <div key={step.number} className="grid grid-cols-[48px_1fr] gap-6 md:gap-8">
                <div className="font-serif text-h1 text-ink-tertiary/40 font-medium leading-none pt-1">{step.number}</div>
                <div>
                  <h2 className="font-serif text-h2 text-ink-primary mb-3">{step.title}</h2>
                  <p className="text-body-lg text-ink-secondary leading-relaxed mb-4">{step.body}</p>
                  <div className="p-4 rounded-xl bg-surface border border-border">
                    <p className="text-body-sm text-ink-secondary leading-relaxed">{step.detail}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 pt-10 border-t border-border">
            <h2 className="font-serif text-h2 text-ink-primary mb-4">What we do not verify</h2>
            <p className="text-body-lg text-ink-secondary leading-relaxed mb-4">
              Being on injector.world does not mean we endorse a provider or guarantee outcomes. We verify licensure and stated credentials. We do not evaluate a provider's specific technique, audit their complication rates, or review individual treatment records.
            </p>
            <p className="text-body text-ink-secondary leading-relaxed">
              The right provider for you depends on your anatomy, your goals, and the specific treatment. Use our directory to shortlist candidates, read their reviews, and consult with more than one before committing.
            </p>
          </div>

          <div className="mt-12 flex flex-wrap gap-4">
            <Link href="/editorial-standards" className="flex items-center gap-1.5 text-body-sm text-brand-accent font-medium hover:underline">
              Our editorial standards
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
