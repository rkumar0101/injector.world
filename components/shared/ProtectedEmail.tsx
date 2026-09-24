'use client'

import { useEffect, useState, type ReactNode } from 'react'

/**
 * An injector.world email link that never appears as an email in the served
 * HTML (2026-09-25, docs/FIX-ALL-PLAN-2026-09-24.md 1.2).
 *
 * DigitalOcean App Platform fronts the site with its own Cloudflare, whose
 * Email Address Obfuscation rewrites every email in the HTML (text and mailto:
 * hrefs) into /cdn-cgi/l/email-protection markup. React then hydrates against
 * markup it did not render and throws #418. That Cloudflare is not a zone we
 * control (DNS is at GoDaddy), so the switch cannot be turned off.
 *
 * So the server renders "legal [at] injector.world" with no mailto, and the
 * real address is filled in after mount. Server render and first client
 * render are identical, so there is nothing to mismatch. Only the mailbox name
 * is passed in; the domain is joined here, so no full address sits in the
 * page's RSC payload either.
 */
const DOMAIN = 'injector.world'

export function ProtectedEmail({
  user,
  subject,
  className,
  children,
}: {
  /** Mailbox name only, e.g. "legal". */
  user: string
  subject?: string
  className?: string
  /** Link text. Defaults to the address itself. */
  children?: ReactNode
}) {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])

  const address = `${user}@${DOMAIN}`
  const href = ready
    ? `mailto:${address}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`
    : undefined

  return (
    <a href={href} className={className}>
      {children ?? (ready ? address : `${user} [at] ${DOMAIN}`)}
    </a>
  )
}
