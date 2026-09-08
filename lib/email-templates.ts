/**
 * Transactional email templates for all non-newsletter flows.
 *
 * Each function returns { html, text } ready for sendTransactional().
 * All dynamic content is HTML-escaped before insertion.
 *
 * Env vars used:
 *   RESEND_API_KEY       — if absent, logs to console (dev fallback)
 *   RESEND_FROM          — from address (default bookings@injector.world)
 *   ADMIN_EMAIL          — admin notification target
 *   FOUNDER_EMAIL        — founder copy on critical notifications
 *   NEXT_PUBLIC_SITE_URL — used in CTA links
 */

import { emailShell, primaryButton } from './email'

export const RESEND_FROM = process.env.RESEND_FROM || 'bookings@injector.world'
export const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@injector.world'
export const FOUNDER_EMAIL = process.env.FOUNDER_EMAIL || ''
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'

function esc(s: string | null | undefined): string {
  if (!s) return ''
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function row(label: string, value: string): string {
  if (!value) return ''
  return `<tr><td style="padding:3px 12px 3px 0;font-size:14px;color:#94A3B8;white-space:nowrap;vertical-align:top;">${esc(label)}</td><td style="padding:3px 0;font-size:14px;color:#0B1B34;">${esc(value)}</td></tr>`
}

function table(rows: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:16px 0 20px;border-collapse:collapse;">${rows}</table>`
}

function p(text: string): string {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.7;color:#475569;">${text}</p>`
}

// ---------------------------------------------------------------------------
// Shared send helper (Resend → console fallback)
// ---------------------------------------------------------------------------
export type SendResult = { delivered: boolean; mode: 'resend' | 'console'; error?: string }

export async function sendTransactional(opts: {
  to: string | string[]
  from?: string
  replyTo?: string
  subject: string
  html: string
  text: string
  tag?: string
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY
  const tag = opts.tag || 'tx'
  const toStr = Array.isArray(opts.to) ? opts.to.join(', ') : opts.to

  if (!key) {
    console.log(`[email:console][${tag}] to="${toStr}" subject="${opts.subject}"`)
    if (opts.replyTo) console.log(`[email:console][${tag}] replyTo="${opts.replyTo}"`)
    console.log(`[email:console][${tag}] text:\n${opts.text.slice(0, 400)}`)
    return { delivered: false, mode: 'console' }
  }

  try {
    const { Resend } = await import('resend')
    const resend = new Resend(key)
    // The Resend SDK does NOT throw on API-level failures (bad/unverified
    // from-domain, sandbox mode restrictions, invalid recipient) — it resolves
    // with { data: null, error } instead. Skipping this check silently drops
    // failed sends with zero logging, which is exactly what happened before.
    const result = await resend.emails.send({
      from: opts.from || RESEND_FROM,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
      replyTo: opts.replyTo,
    } as Parameters<InstanceType<typeof Resend>['emails']['send']>[0])

    if (result?.error) {
      const message = result.error.message || String(result.error)
      console.error(`[email:resend][${tag}] rejected for "${toStr}": ${message}`)
      return { delivered: false, mode: 'resend', error: message }
    }
    return { delivered: true, mode: 'resend' }
  } catch (err) {
    const message = (err as Error)?.message || 'unknown error'
    console.error(`[email:resend][${tag}] failed to "${toStr}":`, message)
    return { delivered: false, mode: 'resend', error: message }
  }
}

// ---------------------------------------------------------------------------
// Admin recipient list (admin + founder, deduped, non-empty)
// ---------------------------------------------------------------------------
export function adminRecipients(): string[] {
  const addrs = [ADMIN_EMAIL, FOUNDER_EMAIL].filter(Boolean)
  return [...new Set(addrs)]
}

// ---------------------------------------------------------------------------
// 1. Booking — patient confirmation
// ---------------------------------------------------------------------------
export function bookingPatientEmail(opts: {
  patientFirstName: string
  providerName: string
  clinicName: string
  serviceTag: string
  preferredDate: string
  message: string
  bookingId: string | number
}): { html: string; text: string } {
  const { patientFirstName, providerName, clinicName, serviceTag, preferredDate, message } = opts
  const dateStr = preferredDate
    ? new Date(preferredDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  const bodyHtml = `
    ${p(`Hi ${esc(patientFirstName)},`)}
    ${p('Your consultation request has been received. Here is a summary:')}
    ${table([
      row('Provider', providerName),
      clinicName ? row('Practice', clinicName) : '',
      serviceTag ? row('Treatment', serviceTag) : '',
      dateStr ? row('Preferred date', dateStr) : '',
      message ? row('Your message', message) : '',
    ].join(''))}
    ${p(`${esc(providerName.split(' ')[0] || providerName)} will be in touch within 24 hours.`)}
    <p style="margin:0 0 14px;font-size:13px;line-height:1.6;color:#94A3B8;">
      This is not a confirmed appointment. Please wait for the provider to contact you.
    </p>
  `

  const text = `Hi ${patientFirstName},\n\nYour consultation request has been received.\n\nProvider: ${providerName}\n${clinicName ? `Practice: ${clinicName}\n` : ''}${serviceTag ? `Treatment: ${serviceTag}\n` : ''}${dateStr ? `Preferred date: ${dateStr}\n` : ''}${message ? `\nYour message:\n${message}\n` : ''}\n${providerName.split(' ')[0] || providerName} will be in touch within 24 hours.\n\nThis is not a confirmed appointment.\n\ninjector.world\n${SITE_URL}`

  return {
    html: emailShell({ siteUrl: SITE_URL, heading: 'Consultation request received', bodyHtml }),
    text,
  }
}

// ---------------------------------------------------------------------------
// 2. Booking — provider new lead
// ---------------------------------------------------------------------------
export function bookingProviderEmail(opts: {
  providerFirstName: string
  patientName: string
  patientEmail: string
  patientPhone: string
  serviceTag: string
  preferredDate: string
  message: string
  bookingId: string | number
}): { html: string; text: string } {
  const { providerFirstName, patientName, patientEmail, patientPhone, serviceTag, preferredDate, message, bookingId } = opts
  const dateStr = preferredDate
    ? new Date(preferredDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  const bodyHtml = `
    ${p(`Hi ${esc(providerFirstName)},`)}
    ${p('You have a new consultation request through injector.world.')}
    ${table([
      row('Patient', patientName),
      row('Email', patientEmail),
      patientPhone ? row('Phone', patientPhone) : '',
      serviceTag ? row('Treatment', serviceTag) : '',
      dateStr ? row('Preferred date', dateStr) : '',
      message ? row('Message', message) : '',
    ].join(''))}
    <p style="margin:0 0 20px;">${primaryButton(`${SITE_URL}/dashboard/clinic`, 'View in your dashboard')}</p>
    <p style="margin:0;font-size:13px;line-height:1.6;color:#94A3B8;">
      Booking ID: ${esc(String(bookingId))}
    </p>
  `

  const text = `Hi ${providerFirstName},\n\nYou have a new consultation request.\n\nPatient: ${patientName}\nEmail: ${patientEmail}\n${patientPhone ? `Phone: ${patientPhone}\n` : ''}${serviceTag ? `Treatment: ${serviceTag}\n` : ''}${dateStr ? `Preferred date: ${dateStr}\n` : ''}${message ? `\nMessage:\n${message}\n` : ''}\nView in your dashboard: ${SITE_URL}/dashboard/clinic\n\nBooking ID: ${bookingId}`

  return {
    html: emailShell({ siteUrl: SITE_URL, heading: 'New consultation request', bodyHtml }),
    text,
  }
}

// ---------------------------------------------------------------------------
// 3. Booking — admin notification
// ---------------------------------------------------------------------------
export function bookingAdminEmail(opts: {
  patientName: string
  patientEmail: string
  patientPhone: string
  providerName: string
  clinicName: string
  serviceTag: string
  preferredDate: string
  message: string
  bookingId: string | number
}): { html: string; text: string } {
  const { patientName, patientEmail, patientPhone, providerName, clinicName, serviceTag, preferredDate, message, bookingId } = opts
  const dateStr = preferredDate
    ? new Date(preferredDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''
  const adminLink = `${SITE_URL}/admin/collections/bookings/${bookingId}`

  const bodyHtml = `
    ${p(`New booking #${esc(String(bookingId))} submitted.`)}
    ${table([
      row('Patient', patientName),
      row('Email', patientEmail),
      patientPhone ? row('Phone', patientPhone) : '',
      row('Provider', providerName),
      clinicName ? row('Practice', clinicName) : '',
      serviceTag ? row('Treatment', serviceTag) : '',
      dateStr ? row('Preferred date', dateStr) : '',
      message ? row('Message', message) : '',
    ].join(''))}
    <p style="margin:0 0 20px;">${primaryButton(adminLink, 'View in admin')}</p>
  `

  const text = `New booking #${bookingId}\n\nPatient: ${patientName}\nEmail: ${patientEmail}\n${patientPhone ? `Phone: ${patientPhone}\n` : ''}Provider: ${providerName}\n${clinicName ? `Practice: ${clinicName}\n` : ''}${serviceTag ? `Treatment: ${serviceTag}\n` : ''}${dateStr ? `Preferred date: ${dateStr}\n` : ''}${message ? `\nMessage:\n${message}\n` : ''}\nView in admin: ${adminLink}`

  return {
    html: emailShell({ siteUrl: SITE_URL, heading: `New booking: ${patientName} for ${providerName}`, bodyHtml }),
    text,
  }
}

// ---------------------------------------------------------------------------
// 4. Claim — admin notification
// ---------------------------------------------------------------------------
export function claimAdminEmail(opts: {
  claimantName: string
  claimantEmail: string
  claimantPhone: string
  /** Claimant's own mobile / inbox, when they gave one. */
  directPhone?: string
  directEmail?: string
  claimType: string
  targetName: string
  roleAtPractice: string
  licenseNumber: string
  npiNumber: string
  message: string
  claimId: string | number
}): { html: string; text: string } {
  const { claimantName, claimantEmail, claimantPhone, directPhone = '', directEmail = '', claimType, targetName, roleAtPractice, licenseNumber, npiNumber, message, claimId } = opts
  const adminLink = `${SITE_URL}/admin/collections/claims/${claimId}`

  const bodyHtml = `
    ${p(`A new profile claim has been submitted for review.`)}
    ${table([
      row('Claimant', claimantName),
      row('Clinic email', claimantEmail),
      claimantPhone ? row('Clinic phone', claimantPhone) : '',
      directEmail ? row('Direct email', directEmail) : '',
      directPhone ? row('Direct number', directPhone) : '',
      row('Claim type', claimType),
      row('Profile', targetName),
      row('Role', roleAtPractice),
      licenseNumber ? row('License', licenseNumber) : '',
      npiNumber ? row('NPI', npiNumber) : '',
      message ? row('Message', message) : '',
    ].join(''))}
    <p style="margin:0 0 20px;">${primaryButton(adminLink, 'Review in admin')}</p>
  `

  const text = `New ${claimType} claim for "${targetName}"\n\nClaimant: ${claimantName}\nEmail: ${claimantEmail}\n${claimantPhone ? `Clinic phone: ${claimantPhone}\n` : ''}${directEmail ? `Direct email: ${directEmail}\n` : ''}${directPhone ? `Direct number: ${directPhone}\n` : ''}Role: ${roleAtPractice}\n${licenseNumber ? `License: ${licenseNumber}\n` : ''}${npiNumber ? `NPI: ${npiNumber}\n` : ''}${message ? `\nMessage:\n${message}\n` : ''}\nReview: ${adminLink}`

  return {
    html: emailShell({ siteUrl: SITE_URL, heading: `New ${claimType} claim: ${targetName}`, bodyHtml }),
    text,
  }
}

// ---------------------------------------------------------------------------
// 5. Claim approved — claimant notification
// ---------------------------------------------------------------------------
export function claimApprovedEmail(opts: {
  claimantName: string
  claimType: string
  targetName: string
  setupToken?: string | null
  isExistingUser: boolean
}): { html: string; text: string } {
  const { claimantName, claimType, targetName, setupToken, isExistingUser } = opts
  const firstName = claimantName.split(' ')[0] || claimantName
  const dashboardUrl = `${SITE_URL}/dashboard/clinic`
  const setupUrl = setupToken ? `${SITE_URL}/setup-account?token=${setupToken}` : dashboardUrl
  const ctaUrl = isExistingUser ? dashboardUrl : setupUrl
  const ctaLabel = isExistingUser ? 'Go to your dashboard' : 'Set up your account'

  const bodyHtml = `
    ${p(`Hi ${esc(firstName)},`)}
    ${p(`Great news: your claim for <strong>${esc(targetName)}</strong> has been approved. Your profile is now under your control.`)}
    ${!isExistingUser ? `
      ${p('We have created an account for you. Click below to set your password and sign in.')}
      <p style="margin:0 0 14px;font-size:13px;color:#94A3B8;">This setup link expires in 7 days.</p>
    ` : `
      ${p('Sign in to your dashboard to update your profile, respond to consultation requests, and manage your listing.')}
    `}
    <p style="margin:0 0 20px;">${primaryButton(ctaUrl, ctaLabel)}</p>
    ${p('If you have questions, reply to this email.')}
  `

  const text = `Hi ${firstName},\n\nYour claim for "${targetName}" has been approved.\n\n${!isExistingUser ? `Set up your account: ${ctaUrl}\n\nThis link expires in 7 days.\n` : `Sign in to your dashboard: ${ctaUrl}\n`}\nQuestions? Reply to this email.\n\ninjector.world`

  return {
    html: emailShell({ siteUrl: SITE_URL, heading: 'Your claim has been approved', bodyHtml }),
    text,
  }
}

// ---------------------------------------------------------------------------
// 6. Register — admin notification (provider / clinic application)
// ---------------------------------------------------------------------------
export function registerAdminEmail(opts: {
  applicantName: string
  applicantEmail: string
  role: string
  licenseState?: string
  licenseNumber?: string
  clinicName?: string
}): { html: string; text: string } {
  const { applicantName, applicantEmail, role, licenseState, licenseNumber, clinicName } = opts
  const adminLink = `${SITE_URL}/admin/collections/users`

  const bodyHtml = `
    ${p('A new provider or clinic application has been submitted.')}
    ${table([
      row('Name', applicantName),
      row('Email', applicantEmail),
      row('Role', role),
      licenseState && licenseNumber ? row('License', `${licenseState} ${licenseNumber}`) : '',
      clinicName ? row('Clinic', clinicName) : '',
    ].join(''))}
    <p style="margin:0 0 20px;">${primaryButton(adminLink, 'Review in admin')}</p>
  `

  const text = `New ${role} application\n\nName: ${applicantName}\nEmail: ${applicantEmail}\nRole: ${role}\n${licenseState && licenseNumber ? `License: ${licenseState} ${licenseNumber}\n` : ''}${clinicName ? `Clinic: ${clinicName}\n` : ''}\nReview: ${adminLink}`

  return {
    html: emailShell({ siteUrl: SITE_URL, heading: `New ${role} application: ${applicantName}`, bodyHtml }),
    text,
  }
}

// ---------------------------------------------------------------------------
// 7. Register — applicant confirmation
// ---------------------------------------------------------------------------
export function registerConfirmEmail(opts: {
  applicantFirstName: string
  role: string
}): { html: string; text: string } {
  const { applicantFirstName, role } = opts
  const isProvider = role === 'provider'

  const bodyHtml = `
    ${p(`Hi ${esc(applicantFirstName)},`)}
    ${p(`We received your ${esc(isProvider ? 'provider' : 'clinic owner')} application for injector.world. Our team will review your credentials and you will hear back within 1 to 2 business days.`)}
    ${p('While you wait, you can browse our treatment guides and directory.')}
    <p style="margin:0 0 20px;">${primaryButton(`${SITE_URL}/guides`, 'Browse treatment guides')}</p>
    ${p('If you have questions, reply to this email.')}
  `

  const text = `Hi ${applicantFirstName},\n\nWe received your ${isProvider ? 'provider' : 'clinic owner'} application. Our team will review it within 1 to 2 business days.\n\nBrowse guides while you wait: ${SITE_URL}/guides\n\ninjector.world`

  return {
    html: emailShell({ siteUrl: SITE_URL, heading: 'Application received', bodyHtml }),
    text,
  }
}

// ---------------------------------------------------------------------------
// 8. Claim invite — outreach to unclaimed clinic owners (Claims Control Center)
// ---------------------------------------------------------------------------
// CAN-SPAM: every invite carries an unsubscribe link and, when set, the
// physical mailing address (NEWSLETTER_ADDRESS). Do not send live without it.
export function claimInviteEmail(opts: {
  clinicName: string
  city: string
  state: string
  claimUrl: string
  unsubscribeUrl: string
}): { html: string; text: string } {
  const { clinicName, city, state, claimUrl, unsubscribeUrl } = opts
  const address = process.env.NEWSLETTER_ADDRESS || ''
  const location = [city, state].filter(Boolean).join(', ')

  const bodyHtml = `
    ${p('Hi there,')}
    ${p(`<strong>${esc(clinicName)}</strong>${location ? ` in ${esc(location)}` : ''} is listed on injector.world, a directory patients use to find trusted aesthetic injectors near them.`)}
    ${p('Your profile is currently unclaimed. Claiming is free and takes about two minutes on your phone. Once verified, you can:')}
    <ul style="margin:0 0 14px;padding-left:20px;font-size:15px;line-height:1.7;color:#475569;">
      <li>Update your hours, services, photos, and pricing</li>
      <li>Receive consultation requests from patients</li>
      <li>Show patients your profile is owner-verified</li>
    </ul>
    <p style="margin:0 0 20px;">${primaryButton(claimUrl, 'Claim your free profile')}</p>
    ${p('Our team verifies every claim, so patients know the information comes from you.')}
    <p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#94A3B8;">
      You received this because ${esc(clinicName)} is publicly listed on injector.world.
      <a href="${unsubscribeUrl}" style="color:#94A3B8;text-decoration:underline;">Unsubscribe</a> to never hear from us again.
      ${address ? `<br />injector.world · ${esc(address)}` : ''}
    </p>
  `

  const text = `Hi there,\n\n${clinicName}${location ? ` in ${location}` : ''} is listed on injector.world, a directory patients use to find trusted aesthetic injectors.\n\nYour profile is currently unclaimed. Claiming is free and takes about two minutes:\n${claimUrl}\n\nOnce verified you can update your hours, services, photos, and pricing, and receive consultation requests from patients.\n\n---\nYou received this because ${clinicName} is publicly listed on injector.world.\nUnsubscribe: ${unsubscribeUrl}\n${address ? `injector.world, ${address}\n` : ''}`

  return {
    html: emailShell({ siteUrl: SITE_URL, heading: `Claim ${clinicName} on injector.world`, bodyHtml }),
    text,
  }
}
