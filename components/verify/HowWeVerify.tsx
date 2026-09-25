import Link from 'next/link'
import { getPayloadInstance } from '@/lib/payload-server'
import { SectionReveal } from '@/components/ui/SectionReveal'

const icons = [
  <svg key="shield" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5l-8-3z" />
    <polyline points="9 12 11 14 15 10" />
  </svg>,
  <svg key="credential" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="9" r="6" />
    <polyline points="9 14 7.5 21 12 18 16.5 21 15 14" />
    <path d="M12 6v3l2 1" />
  </svg>,
  <svg key="reviews" width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    <polygon points="12 8 13.2 10.5 16 11 14 13 14.5 16 12 14.5 9.5 16 10 13 8 11 10.8 10.5" fill="currentColor" stroke="none" />
  </svg>,
]

export async function HowWeVerify() {
  const payload = await getPayloadInstance()
  const pool = (payload.db as any).pool
  const providerCount: number = await pool
    .query(`SELECT COUNT(*)::int AS cnt FROM providers`)
    .then((r: any) => Number(r.rows[0]?.cnt) || 0)
    .catch(() => 0)

  const steps = [
    {
      num: '01',
      title: 'License check',
      body: 'Every injector is verified against the state medical board where they practice. License numbers display on each profile.',
      proof: `${providerCount.toLocaleString()} licenses verified`,
      icon: icons[0],
    },
    {
      num: '02',
      title: 'Credential review',
      body: 'Board certifications, fellowships, and training centers are reviewed by our team before any profile goes live.',
      proof: 'Credentials reviewed',
      icon: icons[1],
    },
    {
      num: '03',
      title: 'Patient reviews moderated',
      body: 'Every review is checked for authenticity and treatment specificity. Injectors cannot delete reviews about themselves.',
      proof: 'Reviews independently moderated',
      icon: icons[2],
    },
  ]

  return (
    <section id="how-we-verify" className="bg-surface py-24 md:py-32">
      <div className="max-canvas">
        <div className="max-w-[720px] mb-16 md:mb-20">
          <h2 className="headline-display text-h2-m md:text-h2 text-ink-primary mb-2">How we verify.</h2>
          <p className="font-serif text-[20px] md:text-[24px] leading-[1.3] text-ink-secondary font-normal">Trust, but verify everyone.</p>
        </div>

        {/* Timeline */}
        <div className="relative">
          {/* Connecting line (desktop only) */}
          <div aria-hidden className="hidden md:block absolute top-[60px] left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-brand-accent/35 to-transparent" />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8 relative items-stretch">
            {steps.map((s, i) => (
              <SectionReveal key={s.num} delay={i * 150} className="h-full">
                <div className="group relative flex flex-col items-center text-center h-full hover:-translate-y-1 transition-transform duration-200">

                  {/* Icon badge */}
                  <div className="relative w-[120px] h-[120px] mb-7">
                    <div className="absolute inset-0 rounded-full bg-brand-accent-soft group-hover:bg-brand-accent/20 transition-colors duration-200" />
                    <div className="absolute inset-3 rounded-full bg-surface-canvas border border-brand-accent/25 group-hover:border-brand-accent/60 group-hover:shadow-[0_8px_24px_rgba(63,166,138,0.22)] flex items-center justify-center text-brand-accent shadow-[0_8px_24px_rgba(11,27,52,0.08)] transition-all duration-200">
                      {s.icon}
                    </div>
                    <div className="absolute -top-1 -right-1 w-10 h-10 rounded-full bg-brand-primary text-surface-canvas text-caption font-bold flex items-center justify-center shadow-md">
                      {s.num}
                    </div>
                  </div>

                  {/* Big title */}
                  <h3 className="font-serif text-[28px] md:text-[32px] leading-[1.1] font-medium mb-4 text-ink-primary tracking-tight md:min-h-[72px] flex items-start justify-center">
                    {s.title}
                  </h3>

                  {/* Body */}
                  <p className="text-body-sm text-ink-secondary leading-[1.6] mb-6 max-w-[280px]">
                    {s.body}
                  </p>

                  {/* Proof chip with pulsing dot */}
                  <div className="mt-auto inline-flex items-center gap-2 px-3.5 py-2 rounded-control bg-surface-canvas border border-border group-hover:border-brand-accent/30 shadow-sm transition-colors duration-200">
                    <span className="relative flex items-center justify-center w-2 h-2" aria-hidden>
                      <span className="absolute inline-flex w-full h-full rounded-full bg-brand-accent/50 animate-ping" />
                      <span className="relative w-1.5 h-1.5 rounded-full bg-brand-accent" />
                    </span>
                    <span className="text-caption font-semibold text-ink-primary">{s.proof}</span>
                  </div>

                  {/* Mobile vertical connector (hidden on md+) */}
                  {i < steps.length - 1 && (
                    <div aria-hidden className="md:hidden mt-10 w-px h-8 bg-gradient-to-b from-brand-accent/35 to-transparent" />
                  )}
                </div>
              </SectionReveal>
            ))}
          </div>
        </div>

        {/* CTA row */}
        <div className="mt-20 md:mt-24 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/editorial-standards"
            className="group inline-flex items-center gap-2 px-6 py-3 rounded-control border border-border bg-surface-canvas text-body-sm font-medium text-ink-primary hover:border-brand-accent hover:shadow-md transition"
          >
            Read our editorial standards
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:translate-x-0.5 transition">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  )
}
