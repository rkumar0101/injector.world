'use client'

import { useState } from 'react'
import { useTurnstile } from '@/components/shared/useTurnstile'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
]

type Props = {
  claimType: 'clinic'
  /** Omit for a new-listing request — there is no profile to point at yet. */
  targetId?: string
  targetName?: string
  /** Prefilled from a signed invite link (?inv=) — the address we emailed. */
  initialEmail?: string
  /**
   * New-listing mode: the owner searched the directory and found nothing, so
   * the form also collects the clinic's name/city/state. Approving the claim
   * creates that clinic as a draft and links it (see Claims.approveClaimHook),
   * which keeps these requests in the same admin queue as normal claims.
   */
  newListing?: boolean
}

export function ClaimForm({ claimType, targetId, targetName, initialEmail = '', newListing = false }: Props) {
  const [fields, setFields] = useState({
    claimantName: '',
    claimantEmail: initialEmail,
    claimantPhone: '',
    directPhone: '',
    directEmail: '',
    roleAtPractice: '',
    licenseNumber: '',
    npiNumber: '',
    businessProof: '',
    message: '',
    requestedClinicName: '',
    requestedCity: '',
    requestedState: '',
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [serverError, setServerError] = useState('')
  // Email-confirmation step: shown after submit when the server emailed a code.
  const [verifyToken, setVerifyToken] = useState('')
  const [code, setCode] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState('')
  const [emailConfirmed, setEmailConfirmed] = useState(false)
  const { token: turnstileToken, containerRef: turnstileRef, reset: resetTurnstile, siteKey } = useTurnstile()

  function set(key: keyof typeof fields, value: string) {
    setFields((prev) => ({ ...prev, [key]: value }))
    setErrors((prev) => ({ ...prev, [key]: '' }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrors({})
    setServerError('')
    setLoading(true)

    const body: Record<string, unknown> = {
      claimType,
      // Exactly one of these identifies what is being claimed: an existing
      // profile's id, or the details of a clinic we do not have yet.
      ...(newListing
        ? {
            requestedClinicName: fields.requestedClinicName,
            requestedCity: fields.requestedCity,
            requestedState: fields.requestedState,
          }
        : { targetId }),
      claimantName: fields.claimantName,
      claimantEmail: fields.claimantEmail,
      claimantPhone: fields.claimantPhone || undefined,
      directPhone: fields.directPhone || undefined,
      directEmail: fields.directEmail || undefined,
      roleAtPractice: fields.roleAtPractice,
      licenseNumber: fields.licenseNumber || undefined,
      npiNumber: fields.npiNumber || undefined,
      businessProof: fields.businessProof || undefined,
      message: fields.message || undefined,
      cfTurnstileToken: turnstileToken || undefined,
    }

    try {
      const res = await fetch('/api/claims', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (data.fieldErrors) {
          setErrors(data.fieldErrors)
        } else {
          setServerError(data.error || 'Something went wrong. Please try again.')
        }
        resetTurnstile()
        setLoading(false)
        return
      }

      // If the server emailed a code, move to the confirmation step. Otherwise
      // (e.g. code email failed) fall straight through to the submitted screen —
      // the claim is already created either way.
      if (data.verifyToken) {
        setVerifyToken(data.verifyToken)
      } else {
        setSubmitted(true)
      }
    } catch {
      setServerError('Network error. Please check your connection and try again.')
      resetTurnstile()
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setVerifyError('')
    if (!/^\d{6}$/.test(code)) {
      setVerifyError('Enter the 6-digit code we emailed you.')
      return
    }
    setVerifying(true)
    try {
      const res = await fetch('/api/claims/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: verifyToken, code }),
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setVerifyError(data.error || 'Could not confirm the code. Please try again.')
        setVerifying(false)
        return
      }
      setEmailConfirmed(true)
      setSubmitted(true)
    } catch {
      setVerifyError('Network error. Please check your connection and try again.')
      setVerifying(false)
    }
  }

  // Email-confirmation step: the claim is already submitted; entering the code
  // just marks it email-verified for our team (optional but speeds up review).
  if (verifyToken && !submitted) {
    return (
      <form onSubmit={handleVerify} className="space-y-5 text-center py-2">
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-accent-soft">
          <svg className="text-brand-accent" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="5" width="18" height="14" rx="2" /><polyline points="3 7 12 13 21 7" />
          </svg>
        </span>
        <h2 className="font-serif text-h3 text-ink-primary">Confirm your email</h2>
        <p className="text-body-sm text-ink-secondary max-w-sm mx-auto">
          We emailed a 6-digit code to <span className="font-medium text-ink-primary">{fields.claimantEmail}</span>. Enter it below to confirm your email and help us verify your claim faster.
        </p>
        <input
          id="claimCode"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={code}
          onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setVerifyError('') }}
          placeholder="000000"
          className="w-40 mx-auto block text-center tracking-[0.4em] min-h-12 px-4 py-3 rounded-md border border-border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body"
        />
        {verifyError && <p className="text-caption text-[#B91C1C]">{verifyError}</p>}
        <button
          type="submit"
          disabled={verifying}
          className="w-full min-h-12 bg-brand-primary text-surface-canvas rounded-control py-3 text-body font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {verifying ? 'Confirming...' : 'Confirm email'}
        </button>
        <button
          type="button"
          onClick={() => setSubmitted(true)}
          className="text-caption text-ink-tertiary hover:text-ink-secondary hover:underline"
        >
          Skip for now
        </button>
      </form>
    )
  }

  if (submitted) {
    return (
      <div className="text-center py-4 space-y-4">
        <span className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-accent-soft">
          <svg className="text-brand-accent" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
        <h2 className="font-serif text-h3 text-ink-primary">Claim submitted</h2>
        {emailConfirmed && (
          <p className="inline-flex items-center gap-1.5 bg-brand-accent-soft text-brand-accent text-[11px] font-semibold px-3 py-1 rounded-control">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
            Email confirmed
          </p>
        )}
        <p className="text-body text-ink-secondary max-w-sm mx-auto">
          Thank you. Our team will verify your credentials for{' '}
          {targetName || fields.requestedClinicName || 'your clinic'} within 2 to 3 business days.
        </p>
        <p className="text-body-sm text-ink-secondary max-w-sm mx-auto">
          {newListing
            ? 'Once approved, we will build your listing and email you a secure link to set up your account. No password needed today.'
            : 'Once approved, we will email you a secure link to set up your account and start editing your profile. No password needed today.'}
        </p>
      </div>
    )
  }

  const isProvider = false

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot: hidden from humans, filled by bots — server discards if non-empty */}
      <input name="website" type="text" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />

      {/* New-listing mode: no profile exists yet, so describe the practice.
          City and state are required — Clinics requires both, and they
          determine the clinic's URL. */}
      {newListing && (
        <>
          <Field
            id="requestedClinicName"
            label="Practice name"
            required
            value={fields.requestedClinicName}
            onChange={(v) => set('requestedClinicName', v)}
            error={errors.requestedClinicName}
            placeholder="Park Avenue Aesthetics"
            autoComplete="organization"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              id="requestedCity"
              label="City"
              required
              value={fields.requestedCity}
              onChange={(v) => set('requestedCity', v)}
              error={errors.requestedCity}
              placeholder="New York"
              autoComplete="address-level2"
            />
            <div>
              <label htmlFor="requestedState" className="block text-body-sm font-medium text-ink-primary mb-1.5">
                State <span className="text-brand-accent">*</span>
              </label>
              <select
                id="requestedState"
                value={fields.requestedState}
                onChange={(e) => set('requestedState', e.target.value)}
                required
                className="w-full px-4 py-3 rounded-md border border-border bg-surface-canvas text-ink-primary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body-sm"
              >
                <option value="">Select state</option>
                {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              {errors.requestedState && (
                <p className="text-caption text-[#B91C1C] mt-1">{errors.requestedState}</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Personal info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          id="claimantName"
          label="Your full name"
          required
          value={fields.claimantName}
          onChange={(v) => set('claimantName', v)}
          error={errors.claimantName}
          placeholder="Dr. Jane Smith"
          autoComplete="name"
        />
        <Field
          id="claimantEmail"
          label="Your clinic email"
          type="email"
          required
          value={fields.claimantEmail}
          onChange={(v) => set('claimantEmail', v)}
          error={errors.claimantEmail}
          placeholder="hello@yourclinic.com"
          autoComplete="email"
          inputMode="email"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          id="roleAtPractice"
          label="Your role at the practice"
          required
          value={fields.roleAtPractice}
          onChange={(v) => set('roleAtPractice', v)}
          error={errors.roleAtPractice}
          placeholder="Owner, Medical Director, Lead Injector..."
          autoComplete="organization-title"
        />
        <Field
          id="claimantPhone"
          label="Your clinic phone number"
          type="tel"
          value={fields.claimantPhone}
          onChange={(v) => set('claimantPhone', v)}
          error={errors.claimantPhone}
          placeholder="(555) 000-0000"
          autoComplete="tel"
          inputMode="tel"
        />
      </div>

      {/* Direct contact: the clinic line is usually a front desk, so we also
          ask how to reach the claimant personally. Both optional. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field
          id="directPhone"
          label="Your direct number (mobile)"
          type="tel"
          value={fields.directPhone}
          onChange={(v) => set('directPhone', v)}
          error={errors.directPhone}
          placeholder="(555) 000-0000"
          autoComplete="tel"
          inputMode="tel"
        />
        <Field
          id="directEmail"
          label="Your direct email address"
          type="email"
          value={fields.directEmail}
          onChange={(v) => set('directEmail', v)}
          error={errors.directEmail}
          placeholder="jane@gmail.com"
          autoComplete="email"
          inputMode="email"
        />
      </div>

      {/* Provider-specific */}
      {isProvider && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field
            id="licenseNumber"
            label="License number"
            value={fields.licenseNumber}
            onChange={(v) => set('licenseNumber', v)}
            error={errors.licenseNumber}
            placeholder="RN-12345"
          />
          <Field
            id="npiNumber"
            label="NPI number (optional)"
            value={fields.npiNumber}
            onChange={(v) => set('npiNumber', v)}
            error={errors.npiNumber}
            placeholder="1234567890"
            inputMode="numeric"
          />
        </div>
      )}

      {/* Clinic-specific */}
      {!isProvider && (
        <Field
          id="businessProof"
          label="Your clinic website"
          value={fields.businessProof}
          onChange={(v) => set('businessProof', v)}
          error={errors.businessProof}
          placeholder="https://yourclinic.com"
        />
      )}

      <div>
        <label htmlFor="message" className="block text-body-sm font-medium text-ink-primary mb-1.5">
          Additional context (optional)
        </label>
        <textarea
          id="message"
          rows={3}
          value={fields.message}
          onChange={(e) => set('message', e.target.value)}
          placeholder="Anything that will help us verify your claim faster."
          className="w-full px-4 py-3 rounded-md border border-border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body resize-none"
        />
      </div>

      {siteKey && (
        <div>
          <div ref={turnstileRef} />
        </div>
      )}

      {serverError && (
        <p className="text-body-sm text-[#B91C1C] bg-[#B91C1C]/5 px-4 py-3 rounded-md border border-[#B91C1C]/20">
          {serverError}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-12 bg-brand-primary text-surface-canvas rounded-control py-3 text-body font-semibold hover:opacity-90 transition disabled:opacity-50"
      >
        {loading ? 'Submitting...' : 'Submit claim'}
      </button>

      <p className="text-caption text-ink-tertiary text-center">
        Already have an account?{' '}
        <a href="/login" className="text-brand-accent hover:underline">
          Sign in
        </a>
      </p>
    </form>
  )
}

function Field({
  id,
  label,
  type = 'text',
  required,
  value,
  onChange,
  error,
  placeholder,
  autoComplete,
  inputMode,
}: {
  id: string
  label: string
  type?: string
  required?: boolean
  value: string
  onChange: (v: string) => void
  error?: string
  placeholder?: string
  autoComplete?: string
  inputMode?: 'text' | 'tel' | 'email' | 'numeric'
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-body-sm font-medium text-ink-primary mb-1.5">
        {label}{required && <span className="text-[#B91C1C] ml-0.5">*</span>}
      </label>
      {/* text-body (16px) on inputs: anything smaller triggers iOS auto-zoom on focus */}
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        autoComplete={autoComplete}
        inputMode={inputMode}
        className={`w-full min-h-12 px-4 py-3 rounded-md border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body ${
          error ? 'border-[#B91C1C]' : 'border-border'
        }`}
      />
      {error && <p className="text-caption text-[#B91C1C] mt-1">{error}</p>}
    </div>
  )
}
