/**
 * Central nav definitions. Used by Header and Footer.
 *
 * The mega-menu era is over: megaMenus / flatNavLinks / navCards / serviceLinks
 * / brandLinks and components/header/MegaPanel.tsx were removed on 2026-09-05.
 * Nothing rendered them any more, and they were the last place still holding
 * links to guide slugs that have never existed in the DB. The live header is
 * CardNavClient, fed by lib/header-config-queries.ts.
 */
export type NavLink = { label: string; href: string; comingSoon?: boolean }

export const footerLinks = {
  services: [
    { label: 'Botox', href: '/services/botox' },
    { label: 'Cheek Filler', href: '/services/cheek-filler' },
    { label: 'Dysport', href: '/services/dysport' },
    { label: 'Jawline Filler', href: '/services/jawline-filler' },
    { label: 'Lip Filler', href: '/services/lip-filler' },
    { label: 'Masseter Botox', href: '/services/masseter-botox' },
    { label: 'Sculptra', href: '/services/sculptra' },
    { label: 'Tear Trough', href: '/services/tear-trough' },
  ],
  // State hubs: every clinic in the state, treatment-agnostic.
  //
  // These moved from the bare `/new-york` shape to `/clinics/new-york` on
  // 2026-09-09, when the location tree consolidated under /clinics and the old
  // shape started 404ing. The footer renders on every page, so these six plus
  // the six below were the only dead links left on the whole site after that
  // migration, and no grep in the migration notes caught them: the hrefs are
  // plain strings in this array, not `href={`...`}` in a component.
  topStates: [
    { label: 'New York', href: '/clinics/new-york' },
    { label: 'California', href: '/clinics/california' },
    { label: 'Florida', href: '/clinics/florida' },
    { label: 'Texas', href: '/clinics/texas' },
    { label: 'Illinois', href: '/clinics/illinois' },
    { label: 'Colorado', href: '/clinics/colorado' },
  ],
  // City hubs. Slugs match the canonical metro Locations in the DB.
  cities: [
    { label: 'New York City', href: '/clinics/new-york/new-york-ny' },
    { label: 'Los Angeles', href: '/clinics/california/los-angeles-ca' },
    { label: 'Miami', href: '/clinics/florida/miami-fl' },
    { label: 'Chicago', href: '/clinics/illinois/chicago-il' },
    { label: 'Houston', href: '/clinics/texas/houston-tx' },
    { label: 'Austin', href: '/clinics/texas/austin-tx' },
  ],
  // Every href here must match a real Guides.slug. Four of the six that used to
  // sit in this list (botox, first-time-botox, botox-cost-2026, md-vs-np-vs-rn)
  // never existed in the DB and rendered as dead footer links.
  guides: [
    { label: 'What is Botox?', href: '/guides/what-is-botox' },
    { label: 'Botox cost', href: '/guides/botox-cost' },
    { label: 'Lip filler', href: '/guides/lip-filler' },
    { label: 'Is Botox safe?', href: '/guides/is-botox-safe' },
    { label: 'Botox side effects', href: '/guides/botox-side-effects' },
    { label: 'Botox vs fillers', href: '/guides/botox-vs-dermal-fillers' },
  ],
  company: [
    { label: 'About', href: '/about' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'List your clinic', href: '/list-your-clinic' },
    { label: 'Editorial standards', href: '/editorial-standards' },
    { label: 'Medical advisory', href: '/medical-advisory' },
    { label: 'Press', href: '/press' },
    { label: 'Careers', href: '/careers' },
  ],
  legal: [
    { label: 'Privacy', href: '/privacy' },
    { label: 'Terms', href: '/terms' },
    { label: 'HIPAA notice', href: '/hipaa' },
    { label: 'Contact', href: '/contact' },
  ],
}

/** Editorial strip at the top of the header drawer. Filled from the latest News
 *  at request time; falls back to navLeadFallback when there is no published news. */
export type NavLead = {
  overline: string
  title: string
  href: string
  allLabel: string
  allHref: string
}

// Shown in the header strip only when there is no published news to feature.
// href must be a real Guides.slug; it used to point at /guides/how-to-choose-injector,
// which has never existed.
export const navLeadFallback: NavLead = {
  overline: 'Featured guide',
  title: 'What Is Botox? How it works, uses, cost and safety',
  href: '/guides/what-is-botox',
  allLabel: 'All guides',
  allHref: '/guides',
}
