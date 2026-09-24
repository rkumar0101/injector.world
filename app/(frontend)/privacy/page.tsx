import type { Metadata } from 'next'
import { staticPageMetadata } from '@/lib/seo-metadata'
import Link from 'next/link'
import { Header } from '@/components/header/Header'
import { Footer } from '@/components/footer/Footer'
import { ProtectedEmail } from '@/components/shared/ProtectedEmail'

export function generateMetadata(): Promise<Metadata> {
  return staticPageMetadata(
    '/privacy',
    'Privacy Policy | injector.world',
    'How injector.world collects, uses, and protects your personal information.',
  )
}

export default function PrivacyPage() {
  return (
    <>
      <Header />

      <section className="bg-surface-warm pt-12 pb-10">
        <div className="max-canvas max-w-3xl">
          <h1 className="font-serif text-h1-m md:text-h1 font-medium leading-tight tracking-tight text-ink-primary mb-3">Privacy policy</h1>
          <p className="text-body text-ink-tertiary">Last updated: June 3, 2026</p>
        </div>
      </section>

      <section className="section-pad bg-surface-canvas">
        <div className="max-canvas max-w-3xl prose-guide space-y-8">
          <div>
            <h2>What we collect</h2>
            <p>When you use injector.world, we may collect: your email address if you create an account or submit a booking request, search queries and browsing behavior (via analytics), and any information you submit through forms. We do not sell your personal data to third parties.</p>
          </div>
          <div>
            <h2>How we use it</h2>
            <p>We use your data to operate the directory, send booking notifications, improve the product through analytics, and respond to support requests. We do not use your data for targeted advertising.</p>
          </div>
          <div>
            <h2>Cookies</h2>
            <p>We use cookies for session management and anonymous analytics (Vercel Analytics). We do not use third-party advertising cookies.</p>
          </div>
          <div>
            <h2>Data retention</h2>
            <p>Account data is retained until you delete your account. Booking records are retained for 3 years for legal compliance. Analytics data is retained for 26 months.</p>
          </div>
          <div>
            <h2>Your rights</h2>
            <p>You may request a copy of your data, correct inaccurate data, or request deletion of your account by contacting <ProtectedEmail user="legal" />. California residents have additional rights under CCPA.</p>
          </div>
          <div>
            <h2>Contact</h2>
            <p><ProtectedEmail user="legal" /></p>
          </div>
          <div className="flex gap-4 pt-4 border-t border-border">
            <Link href="/terms" className="text-body-sm text-brand-accent hover:underline">Terms of use</Link>
            <Link href="/hipaa" className="text-body-sm text-brand-accent hover:underline">HIPAA notice</Link>
          </div>
        </div>
      </section>

      <Footer />
    </>
  )
}
