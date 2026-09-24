import type { Metadata } from 'next'
import { staticPageMetadata } from '@/lib/seo-metadata'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ProtectedEmail } from '@/components/shared/ProtectedEmail'

export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata(
    '/list-your-clinic',
    'List Your Clinic | injector.world',
    'Add your aesthetic clinic to the injector.world directory. Reach patients who are actively searching for verified clinics.',
  )
}

const benefits = [
  { title: 'Patients who are ready to book', body: 'Visitors to injector.world are in active research mode. They are comparing clinics, reading reviews, and looking for someone they trust.' },
  { title: 'License-verified badge', body: 'We check your license against the state medical board and display a verified badge on your profile. Patients filter by this first.' },
  { title: 'Real patient reviews', body: 'Aggregate your existing reviews from Google, Healthgrades, Vitals, and Zocdoc in one place. No starting from zero.' },
  { title: 'Service-specific pages', body: 'Your profile is indexed across every service you offer. A patient searching Botox in NYC and one searching tear trough filler in NYC can both find you.' },
  { title: 'Editorial integrity', body: 'Our rankings are not for sale. Your placement in the directory reflects your verified credentials and patient reviews, not your advertising budget.' },
]

export default function ListYourClinicPage() {
  return (
    <>
      <Header />

      <section className="bg-surface-warm pt-12 pb-10 md:pt-16 md:pb-12">
        <div className="max-canvas max-w-3xl">
          <span className="text-overline uppercase tracking-widest font-semibold text-brand-accent mb-4 block">
            For clinics
          </span>
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            List your clinic on injector.world
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-ink-secondary mb-8">
            Reach patients who are actively searching for a verified aesthetic clinic near them.
          </p>
          {/* Most clinics are already in the directory, so claiming is the
              primary action here and a blank application is the fallback. */}
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/claim"
              className="inline-flex items-center gap-2 bg-brand-primary text-surface-canvas rounded-control px-8 py-4 text-body font-semibold hover:opacity-90 transition"
            >
              Find and claim your clinic
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="9 18 15 12 9 6" /></svg>
            </Link>
            <p className="text-body-sm text-ink-secondary">
              Already claimed?{' '}
              <Link href="/login?tab=practice" className="text-brand-accent hover:underline">
                Sign in
              </Link>
            </p>
          </div>
          <p className="text-body-sm text-ink-secondary mt-4">
            Not in the directory yet?{' '}
            <Link href="/register" className="text-brand-accent hover:underline">
              Apply to get listed
            </Link>
          </p>
        </div>
      </section>

      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-12 lg:gap-16">

            <div>
              <h2 className="font-serif text-h2 text-ink-primary mb-8">Why injector.world</h2>
              <div className="space-y-8">
                {benefits.map((b) => (
                  <div key={b.title} className="flex items-start gap-4">
                    <span className="w-6 h-6 rounded-full bg-brand-accent flex items-center justify-center flex-shrink-0 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                    </span>
                    <div>
                      <div className="font-semibold text-body text-ink-primary mb-1">{b.title}</div>
                      <div className="text-body-sm text-ink-secondary leading-relaxed">{b.body}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-12 pt-8 border-t border-border">
                <h2 className="font-serif text-h2 text-ink-primary mb-4">How listing works</h2>
                <ol className="space-y-5">
                  {[
                    { n: '1', text: 'Search the directory for your clinic. Most are already listed from public records.' },
                    { n: '2', text: <>Claim the profile with your license number and clinic details, or email <ProtectedEmail user="clinics" />.</> },
                    { n: '3', text: 'We verify your license against the state medical board. This typically takes 2 to 3 business days.' },
                    { n: '4', text: 'We email you a secure link to set up your account, then you can edit your profile and receive bookings.' },
                  ].map((step) => (
                    <li key={step.n} className="flex items-start gap-4 text-body text-ink-secondary">
                      <span className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center flex-shrink-0 text-body-sm font-semibold text-ink-primary">{step.n}</span>
                      {step.text}
                    </li>
                  ))}
                </ol>
              </div>
            </div>

            <div className="space-y-5 lg:sticky lg:top-24">
              <div className="rounded-2xl border border-border bg-surface-warm p-6">
                <h3 className="font-serif text-h3 text-ink-primary mb-4">Get in touch</h3>
                <p className="text-body-sm text-ink-secondary mb-5">
                  Send us your license number and we will start the verification process.
                </p>
                <ProtectedEmail
                  user="clinics"
                  className="flex w-full items-center justify-center gap-2 bg-brand-primary text-surface-canvas rounded-control py-3 text-body-sm font-semibold hover:opacity-90 transition"
                />
              </div>

              <div className="rounded-xl border border-border-subtle bg-surface p-4 text-caption text-ink-tertiary leading-relaxed space-y-2">
                <p>Listing is free for verified clinics. Premium sponsored placement is available separately.</p>
                <Link href="/how-we-verify" className="block text-brand-accent hover:underline">How verification works</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
