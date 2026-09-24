import type { Metadata } from 'next'
import { staticPageMetadata } from '@/lib/seo-metadata'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ProtectedEmail } from '@/components/shared/ProtectedEmail'

export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata(
    '/contact',
    'Contact | injector.world',
    'Contact the injector.world editorial and provider team.',
  )
}

const contacts = [
  { label: 'Editorial', desc: 'Corrections, article feedback, or editorial inquiries.', email: 'editorial' },
  { label: 'Clinic listings', desc: 'Adding a new clinic, updating your profile, or claiming an existing listing.', email: 'clinics' },
  { label: 'Patient support', desc: 'Questions about the directory, reviews, or your account.', email: 'hello' },
  { label: 'Press', desc: 'Media inquiries and interview requests.', email: 'press' },
  { label: 'Legal', desc: 'Privacy requests, HIPAA inquiries, or legal notices.', email: 'legal' },
]

export default function ContactPage() {
  return (
    <>
      <Header />

      <section className="bg-surface-warm pt-12 pb-10">
        <div className="max-canvas max-w-3xl">
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-4">
            Contact
          </h1>
          <p className="font-serif text-lede-m md:text-lede text-ink-secondary">
            Use the right address and you will hear back faster.
          </p>
        </div>
      </section>

      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas max-w-3xl">
          <div className="space-y-4">
            {contacts.map((c) => (
              <div key={c.label} className="flex items-start justify-between gap-6 p-5 rounded-xl border border-border bg-surface">
                <div>
                  <div className="font-semibold text-body text-ink-primary mb-1">{c.label}</div>
                  <div className="text-body-sm text-ink-secondary">{c.desc}</div>
                </div>
                {/* Mailbox name only: see ProtectedEmail for why no full address
                    may appear in the served HTML. */}
                <ProtectedEmail user={c.email} className="flex-shrink-0 text-body-sm text-brand-accent font-medium hover:underline mt-0.5" />
              </div>
            ))}
          </div>

          <div className="mt-10 pt-8 border-t border-border text-body-sm text-ink-tertiary">
            <p>We aim to respond within 2 business days. For urgent patient safety concerns, contact your state medical board directly.</p>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
