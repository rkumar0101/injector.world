import type { Metadata } from 'next'
import { staticPageMetadata } from '@/lib/seo-metadata'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ProtectedEmail } from '@/components/shared/ProtectedEmail'

// The old title already ended in the brand, so the layout template printed it
// twice ("Pricing, dash, injector.world | injector.world"). Now the same shape
// as the other fixed pages, and the page gets the canonical it never had.
export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata(
    '/pricing',
    'Pricing | injector.world',
    'Free and paid plans for injectors and clinics on injector.world. Verification and organic rankings are free for every provider.',
  )
}

type TierLink = { ctaHref: string; ctaMail?: { user: string; subject: string }; cta: string }

/**
 * A tier's button. Paid tiers open an email, which must not appear as an
 * address in the served HTML (DigitalOcean's Cloudflare rewrites it and React
 * throws #418), so those go through ProtectedEmail. 2026-09-25.
 */
function TierCta({ tier, className }: { tier: TierLink; className: string }) {
  if (tier.ctaMail) {
    return (
      <ProtectedEmail user={tier.ctaMail.user} subject={tier.ctaMail.subject} className={className}>
        {tier.cta}
      </ProtectedEmail>
    )
  }
  return (
    <a href={tier.ctaHref} className={className}>
      {tier.cta}
    </a>
  )
}

const TIERS: Array<TierLink & Record<string, any>> = [
  {
    id: 'free',
    label: 'Free',
    price: '$0',
    period: '',
    tagline: 'Get listed and verified at no cost.',
    cta: 'Claim your profile',
    ctaHref: '/list-your-clinic',
    ctaStyle: 'border',
    highlight: false,
  },
  {
    id: 'starter',
    label: 'Starter',
    price: '$99',
    period: '/mo',
    tagline: 'Social presence and more photos.',
    cta: 'Request Starter',
    ctaHref: '', ctaMail: { user: 'hello', subject: 'Upgrade request: Starter plan' },
    ctaStyle: 'border',
    highlight: false,
  },
  {
    id: 'pro',
    label: 'Pro',
    price: '$249',
    period: '/mo',
    tagline: 'Gallery, analytics, and an ad-free profile.',
    cta: 'Request Pro',
    ctaHref: '', ctaMail: { user: 'hello', subject: 'Upgrade request: Pro plan' },
    ctaStyle: 'solid',
    highlight: true,
  },
  {
    id: 'elite',
    label: 'Elite',
    price: '$499',
    period: '/mo',
    tagline: 'Full analytics and multi-location management.',
    cta: 'Request Elite',
    ctaHref: '', ctaMail: { user: 'hello', subject: 'Upgrade request: Elite plan' },
    ctaStyle: 'border',
    highlight: false,
  },
] as const

type Check = 'yes' | 'no' | string

const FEATURES: { label: string; sub?: string; values: [Check, Check, Check, Check] }[] = [
  { label: 'Profile page + license verification badge', values: ['yes', 'yes', 'yes', 'yes'] },
  { label: 'City listing + organic ranking', sub: 'Always based on merit. Never buyable.', values: ['yes', 'yes', 'yes', 'yes'] },
  { label: 'Photos', values: ['1', '5', '15', 'Unlimited'] },
  { label: 'Instagram + TikTok links', values: ['no', 'yes', 'yes', 'yes'] },
  { label: 'Booking / website link', values: ['no', 'yes', 'yes', 'yes'] },
  { label: 'Before and after gallery', values: ['no', 'no', 'yes', 'yes'] },
  { label: 'Analytics: profile views + lead count', values: ['no', 'no', 'yes', 'yes'] },
  { label: 'Analytics: referrer breakdown', values: ['no', 'no', 'no', 'yes'] },
  { label: 'Ad-free profile page', sub: 'No competitor suggestions shown to your visitors.', values: ['no', 'no', 'yes', 'yes'] },
  { label: 'Multi-location + brand management', values: ['no', 'no', 'no', 'yes'] },
]

function Cell({ value, highlight }: { value: Check; highlight: boolean }) {
  if (value === 'yes') {
    return (
      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${highlight ? 'bg-brand-primary text-surface-canvas' : 'bg-brand-accent-soft text-brand-accent'}`}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </span>
    )
  }
  if (value === 'no') {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface border border-border text-ink-tertiary">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </span>
    )
  }
  return (
    <span className={`text-body-sm font-semibold ${highlight ? 'text-ink-primary' : 'text-ink-secondary'}`}>
      {value}
    </span>
  )
}

export default function PricingPage() {
  return (
    <>
      <Header />

      <main className="bg-surface-canvas">

        {/* Hero */}
        <section className="section-pad border-b border-border">
          <div className="max-canvas text-center max-w-2xl mx-auto">
            <p className="text-caption text-brand-accent font-semibold uppercase tracking-widest mb-3">Pricing</p>
            <h1 className="font-serif text-h1-m md:text-[2.5rem] font-medium leading-tight text-ink-primary mb-4">
              Simple plans for every practice
            </h1>
            <p className="text-body-lg text-ink-secondary">
              Every provider gets a free verified profile and appears in city listings based on merit. Paid plans unlock richer profiles, analytics, and more.
            </p>
          </div>
        </section>

        {/* Trust callout */}
        <div className="bg-brand-accent-soft border-b border-border">
          <div className="max-canvas py-4 flex flex-col sm:flex-row items-center justify-center gap-3 text-center sm:text-left">
            <span className="inline-flex items-center gap-2 text-body-sm font-semibold text-brand-accent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              </svg>
              Verification badge, license check, and organic ranking are free for every provider.
            </span>
            <span className="text-body-sm text-brand-accent/80">Organic rankings can never be bought.</span>
          </div>
        </div>

        {/* Pricing cards — desktop */}
        <section className="section-pad">
          <div className="max-canvas">

            {/* Mobile: stacked cards */}
            <div className="grid grid-cols-1 gap-6 md:hidden">
              {TIERS.map((tier) => (
                <div
                  key={tier.id}
                  className={`rounded-2xl border p-6 ${tier.highlight ? 'border-brand-primary bg-surface shadow-md' : 'border-border bg-surface'}`}
                >
                  {tier.highlight && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-brand-accent mb-3">Most popular</p>
                  )}
                  <div className="flex items-end gap-1.5 mb-1">
                    <span className="font-serif text-[2rem] leading-none font-medium text-ink-primary">{tier.price}</span>
                    {tier.period && <span className="text-body-sm text-ink-tertiary mb-1">{tier.period}</span>}
                  </div>
                  <p className="text-h4 font-semibold text-ink-primary mb-1">{tier.label}</p>
                  <p className="text-body-sm text-ink-secondary mb-5">{tier.tagline}</p>
                  <TierCta
                    tier={tier}
                    className={`block w-full text-center rounded-control py-3 text-body-sm font-semibold transition ${
                      tier.ctaStyle === 'solid'
                        ? 'bg-brand-primary text-surface-canvas hover:opacity-90'
                        : 'border border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-surface-canvas'
                    }`}
                  />
                  {/* Feature list on mobile */}
                  <ul className="mt-5 space-y-2.5">
                    {FEATURES.map((f) => {
                      const val = f.values[TIERS.indexOf(tier)]
                      if (val === 'no') return null
                      return (
                        <li key={f.label} className="flex items-center gap-2.5 text-body-sm text-ink-secondary">
                          <span className="flex-shrink-0 w-4 h-4 rounded-full bg-brand-accent-soft flex items-center justify-center">
                            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--brand-accent))" strokeWidth="3">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          </span>
                          {f.label} {val !== 'yes' ? `(${val})` : ''}
                        </li>
                      )
                    })}
                  </ul>
                </div>
              ))}
            </div>

            {/* Desktop: comparison table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="text-left pb-6 pr-6 align-bottom w-[36%]">
                      <span className="text-body-sm font-medium text-ink-tertiary">Features</span>
                    </th>
                    {TIERS.map((tier) => (
                      <th key={tier.id} className="pb-6 px-4 align-bottom text-center">
                        <div className={`rounded-2xl border p-5 ${tier.highlight ? 'border-brand-primary bg-surface shadow-md' : 'border-border bg-surface'}`}>
                          {tier.highlight && (
                            <p className="text-[10px] font-bold uppercase tracking-widest text-brand-accent mb-2">Most popular</p>
                          )}
                          <p className="font-semibold text-body text-ink-primary mb-0.5">{tier.label}</p>
                          <div className="flex items-end justify-center gap-1 mb-3">
                            <span className="font-serif text-[1.75rem] leading-none font-medium text-ink-primary">{tier.price}</span>
                            {tier.period && <span className="text-body-sm text-ink-tertiary mb-0.5">{tier.period}</span>}
                          </div>
                          <TierCta
                            tier={tier}
                            className={`block w-full text-center rounded-control py-2.5 text-body-sm font-semibold transition ${
                              tier.ctaStyle === 'solid'
                                ? 'bg-brand-primary text-surface-canvas hover:opacity-90'
                                : 'border border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-surface-canvas'
                            }`}
                          />
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {FEATURES.map((feature, i) => (
                    <tr key={feature.label} className={i % 2 === 0 ? 'bg-surface-warm/50' : ''}>
                      <td className="py-4 pr-6 text-body-sm text-ink-primary">
                        {feature.label}
                        {feature.sub && (
                          <span className="block text-caption text-ink-tertiary mt-0.5">{feature.sub}</span>
                        )}
                      </td>
                      {feature.values.map((val, ti) => (
                        <td key={ti} className="py-4 px-4 text-center">
                          <Cell value={val} highlight={TIERS[ti].highlight} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="text-caption text-ink-tertiary text-center mt-8">
              Paid plans are billed monthly. To upgrade, email{' '}
              <ProtectedEmail user="hello" className="text-brand-accent hover:underline" />{' '}
              with your plan request. Stripe self-serve billing coming soon.
            </p>

          </div>
        </section>

        {/* FAQ strip */}
        <section className="bg-surface border-t border-border section-pad">
          <div className="max-canvas max-w-2xl mx-auto space-y-8">
            <h2 className="font-serif text-h2 text-ink-primary text-center mb-10">Questions</h2>
            {[
              {
                q: 'Can my ranking be boosted by paying for a plan?',
                a: 'No. Organic rankings are based on merit: ratings, reviews, profile completeness, and verification. A paid plan does not affect your rank in organic listings. Featured/sponsored slots are sold separately and are clearly labeled as sponsored.',
              },
              {
                q: 'What happens to my data if I downgrade?',
                a: 'Your data is never deleted on a downgrade. Photos, social links, and other content are saved and become visible again if you re-upgrade. Only the features gated by your new tier are hidden from your public profile.',
              },
              {
                q: 'Is the verification badge available on the free plan?',
                a: 'Yes. License verification and the verified badge are free for every provider, always. Trust is the foundation of injector.world and will never be paywalled.',
              },
              {
                q: 'How does manual billing work?',
                a: 'Email us your upgrade request and we will set your plan and send an invoice. Stripe self-serve billing is coming soon.',
              },
            ].map((faq) => (
              <div key={faq.q} className="border-b border-border pb-6">
                <p className="font-semibold text-body text-ink-primary mb-2">{faq.q}</p>
                <p className="text-body-sm text-ink-secondary leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="bg-[#0B1B34] section-pad text-center">
          <div className="max-canvas max-w-xl mx-auto">
            <h2 className="font-serif text-h2 text-white mb-4">Start for free</h2>
            <p className="text-body text-white/70 mb-8">
              Claim your profile, get verified, and appear in front of patients searching in your city. No credit card required.
            </p>
            <Link
              href="/list-your-clinic"
              className="inline-flex items-center gap-2 bg-brand-accent text-white rounded-control px-8 py-4 font-semibold text-body hover:opacity-90 transition"
            >
              Claim your free profile
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </Link>
          </div>
        </section>

      </main>

      <Footer />
    </>
  )
}
