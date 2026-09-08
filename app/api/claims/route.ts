import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getPayload } from 'payload'
import config from '@/payload.config'
import { RateLimiter, checkOrigin, getIp } from '@/lib/rate-limit'
import { verifyTurnstile } from '@/lib/captcha'
import { generateVerificationCode } from '@/lib/verification-code'
import { sendTransactional, adminRecipients, claimAdminEmail } from '@/lib/email-templates'
import { emailShell } from '@/lib/email'

/**
 * Compare the claimant's email against a profile's on-file contact so the admin
 * gets a match signal at review time. Never blocks — just labels the claim.
 *   exact  = same email on file
 *   domain = same domain as the on-file email or website
 *   none   = a contact exists but nothing matches (extra caution)
 *   unknown = no contact on file to compare against
 */
function computeEmailMatch(
  claimEmail: string,
  targetEmail: string | null | undefined,
  targetWebsite: string | null | undefined,
): 'exact' | 'domain' | 'none' | 'unknown' {
  const ce = claimEmail.toLowerCase().trim()
  const claimDomain = ce.split('@')[1] || ''
  const te = (targetEmail || '').toLowerCase().trim()
  let webDomain = ''
  if (targetWebsite) {
    try {
      webDomain = new URL(targetWebsite).hostname.replace(/^www\./, '').toLowerCase()
    } catch {
      /* unparsable website — ignore */
    }
  }
  if (!te && !webDomain) return 'unknown'
  if (te && te === ce) return 'exact'
  const teDomain = te.split('@')[1] || ''
  if (claimDomain && (claimDomain === teDomain || claimDomain === webDomain)) return 'domain'
  return 'none'
}

// 3 claim submissions per IP per hour.
const limiter = new RateLimiter(3, 60 * 60 * 1000)

const ClaimBase = {
  claimantName: z.string().min(1, 'Name is required').max(200),
  claimantEmail: z.string().email('Enter a valid email address'),
  claimantPhone: z.string().max(30).optional(),
  directPhone: z.string().max(30).optional(),
  // Optional, so an empty string must not fail email validation.
  directEmail: z.union([z.string().email('Enter a valid email address'), z.literal('')]).optional(),
  roleAtPractice: z.string().min(1, 'Your role at the practice is required').max(100),
  licenseNumber: z.string().max(100).optional(),
  npiNumber: z.string().max(20).optional(),
  businessProof: z.string().max(500).optional(),
  message: z.string().max(2000).optional(),
  cfTurnstileToken: z.string().optional(),
}

// Claiming an existing profile.
const ExistingProfileClaim = z.object({
  claimType: z.literal('clinic'),
  targetId: z.string().min(1, 'Target ID is required'),
  ...ClaimBase,
})

// "My practice is not listed": no profile to point at, so the request carries
// the details needed to create one on approval. City and state are required
// because Clinics requires them and they determine the clinic's URL.
const NewListingClaim = z.object({
  claimType: z.literal('clinic'),
  targetId: z.undefined().optional(),
  requestedClinicName: z.string().min(1, 'Clinic name is required').max(200),
  requestedCity: z.string().min(1, 'City is required').max(100),
  requestedState: z.string().length(2, 'Select a state'),
  ...ClaimBase,
})

// Try the existing-profile shape first; a body without targetId falls through
// to the new-listing shape, so an old client can never accidentally match it.
const ClaimSchema = z.union([ExistingProfileClaim, NewListingClaim])

export async function GET(req: NextRequest) {
  const payload = await getPayload({ config })
  const { user } = await payload.auth({ headers: req.headers })
  if (!user || (user.role !== 'admin' && user.role !== 'editor')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(req.url)
  const status = url.searchParams.get('where[status][equals]')
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '10', 10), 100)
  const sort = url.searchParams.get('sort') ?? '-createdAt'
  const depth = parseInt(url.searchParams.get('depth') ?? '0', 10)

  const result = await payload.find({
    collection: 'claims',
    where: status ? { status: { equals: status } } : {},
    limit,
    sort,
    depth,
    overrideAccess: true,
  })

  return NextResponse.json(result)
}

export async function POST(req: NextRequest) {
  if (!checkOrigin(req)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }
  if (!(await limiter.check(getIp(req)))) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before submitting another claim.' },
      { status: 429 },
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }
  // Honeypot: bots fill hidden fields; humans leave them empty.
  if ((raw as any)?.website) {
    return NextResponse.json({ success: true })
  }

  const parsed = ClaimSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as string
      if (key) fieldErrors[key] = issue.message
    }
    return NextResponse.json({ error: 'Validation failed.', fieldErrors }, { status: 422 })
  }

  const {
    claimType,
    claimantName,
    claimantEmail,
    claimantPhone,
    directPhone,
    directEmail,
    roleAtPractice,
    licenseNumber,
    npiNumber,
    businessProof,
    message,
    cfTurnstileToken,
  } = parsed.data

  const isNewListing = !('targetId' in parsed.data) || !parsed.data.targetId
  const targetId = isNewListing ? undefined : (parsed.data as { targetId: string }).targetId

  // HD1: Verify Turnstile CAPTCHA to block automated claim submissions.
  const captchaOk = await verifyTurnstile(cfTurnstileToken, getIp(req))
  if (!captchaOk) {
    return NextResponse.json({ error: 'CAPTCHA verification failed. Please try again.' }, { status: 400 })
  }

  // Relationship IDs must be raw numbers for the Postgres adapter (locked rule).
  // The form sends targetId as a string, so coerce it here or the claim create
  // fails validation ("Target Clinic invalid"). New-listing claims have no
  // target at all — the clinic is created on approval.
  let targetIdNum = NaN
  if (!isNewListing) {
    targetIdNum = parseInt(targetId as string, 10)
    if (Number.isNaN(targetIdNum)) {
      return NextResponse.json({ error: 'Invalid profile reference.' }, { status: 400 })
    }
  }

  // Payload stores auth emails lowercased; normalize here so the claim record,
  // the on-file match check, and the later approval lookup all agree.
  const normEmail = claimantEmail.toLowerCase().trim()

  const payload = await getPayload({ config })

  // Verify the target exists and is not already claimed. Also grab its on-file
  // contact so we can label how well the claimant email matches (admin signal).
  // A new-listing claim has no target to check, and no on-file contact to
  // compare against, so it stays 'unknown' — the same value used whenever a
  // profile has no contact details.
  let emailMatch: 'exact' | 'domain' | 'none' | 'unknown' = 'unknown'
  if (!isNewListing) try {
    const target = await payload.findByID({
      collection: 'clinics',
      id: targetIdNum,
      depth: 0,
      overrideAccess: true,
    })
    if (!target) {
      console.log('[claims] target not found:', claimType, targetId)
      return NextResponse.json({ success: true, message: 'If a matching profile was found, your claim has been submitted for review.' })
    }
    if ((target as any).claimed) {
      return NextResponse.json(
        { error: 'This profile has already been claimed.' },
        { status: 409 },
      )
    }
    emailMatch = computeEmailMatch(normEmail, (target as any).email, (target as any).websiteUrl)
  } catch {
    console.log('[claims] lookup failed:', claimType, targetId)
    return NextResponse.json({ success: true, message: 'If a matching profile was found, your claim has been submitted for review.' })
  }

  // Create the claim record
  try {
    // 6-digit email-confirmation code + an opaque token the claim page uses to
    // submit it back (POST /api/claims/verify). Confirming proves the claimant
    // controls this inbox. It never blocks submission — an unconfirmed claim is
    // still created, just flagged emailVerified=false for the admin.
    const verificationCode = generateVerificationCode()
    const verificationCodeExpiry = new Date(Date.now() + 30 * 60 * 1000).toISOString()
    const verifyToken = crypto.randomBytes(24).toString('hex')

    const claimData: Record<string, unknown> = {
      claimType,
      claimantName,
      claimantEmail: normEmail,
      claimantPhone: claimantPhone || undefined,
      directPhone: directPhone || undefined,
      directEmail: directEmail ? directEmail.toLowerCase().trim() : undefined,
      roleAtPractice,
      licenseNumber: licenseNumber || undefined,
      npiNumber: npiNumber || undefined,
      businessProof: businessProof || undefined,
      message: message || undefined,
      status: 'new',
      emailVerified: false,
      emailMatch,
      verificationCode,
      verificationCodeExpiry,
      verifyToken,
    }
    if (isNewListing) {
      const d = parsed.data as { requestedClinicName: string; requestedCity: string; requestedState: string }
      claimData.requestedClinicName = d.requestedClinicName.trim()
      claimData.requestedCity = d.requestedCity.trim()
      claimData.requestedState = d.requestedState.trim().toUpperCase()
    } else {
      claimData.targetClinic = targetIdNum
    }

    const created = await payload.create({
      collection: 'claims',
      data: claimData as any,
      overrideAccess: true,
    })

    // Email the confirmation code to the claimant (non-blocking on failure).
    let codeSent = false
    try {
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://injector.world'
      await payload.sendEmail({
        to: normEmail,
        subject: `${verificationCode} is your injector.world claim code`,
        html: emailShell({
          siteUrl,
          heading: 'Confirm your email',
          bodyHtml: `
            <p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#475569;">
              Enter this code on the claim page to confirm the email for your claim. It expires in 30 minutes.
              Confirming helps us verify you faster.
            </p>
            <p style="margin:0 0 22px;font-size:32px;font-weight:700;letter-spacing:0.08em;color:#0B1B34;">${verificationCode}</p>
            <p style="margin:0;font-size:13px;line-height:1.6;color:#94A3B8;">
              If you did not request this, you can safely ignore this email.
            </p>`,
        }),
      })
      codeSent = true
    } catch (mailErr) {
      console.error('[claims] verification code email failed:', mailErr)
    }

    // Notify admin + founder of the new claim (non-blocking). A new-listing
    // claim has no profile to name yet, so use what the owner typed.
    const targetName = isNewListing
      ? `${(parsed.data as { requestedClinicName: string }).requestedClinicName} (new listing request)`
      : (await payload.findByID({ collection: 'clinics', id: targetIdNum, depth: 0, overrideAccess: true }).catch(() => null) as any)?.clinicName || `Clinic #${targetIdNum}`

    void sendTransactional({
      to: adminRecipients(),
      subject: `New ${claimType} claim: ${claimantName}`,
      ...claimAdminEmail({
        claimantName,
        claimantEmail: normEmail,
        claimantPhone: claimantPhone || '',
        directPhone: directPhone || '',
        directEmail: directEmail || '',
        claimType,
        targetName,
        roleAtPractice,
        licenseNumber: licenseNumber || '',
        npiNumber: npiNumber || '',
        message: message || '',
        claimId: created.id,
      }),
      tag: 'claim-admin',
    })

    // Only hand the form a verifyToken when the code actually went out, so it
    // shows the code-entry step. If the email failed, the claim still stands —
    // the form just shows the normal "submitted" confirmation instead.
    return NextResponse.json(
      codeSent
        ? { success: true, verifyToken, email: normEmail }
        : { success: true },
    )
  } catch (err: any) {
    console.error('[claims] create failed:', err)
    return NextResponse.json(
      { error: 'Could not submit your claim. Please try again.' },
      { status: 500 },
    )
  }
}
