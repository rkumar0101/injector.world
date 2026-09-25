'use client'

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { track } from '@/lib/analytics/client'
import { FieldHint } from '@/components/shared/FieldHint'

/**
 * The consultation request form itself: validation, Turnstile, GTM events and
 * the POST to /api/bookings.
 *
 * Lifted out of BookingModal on 2026-08-06 so the clinic profile can render the
 * same form inline in its sidebar (client request) without a second copy of
 * this logic. The modal still owns its dialog chrome and its auto-close; this
 * component owns everything inside the <form>.
 *
 * `active` replaces what used to be the modal's `open`: Turnstile only renders
 * while the form is on screen, and the fields reset whenever it goes away. The
 * inline variant just passes true.
 */

export type TreatmentOption = { id: number; name: string }
export type BookingKind = 'clinic'
type FormState = 'idle' | 'submitting' | 'success'

const DATE_RANGE_OPTIONS = [
  { value: 'next-7-days', label: 'Next 7 days' },
  { value: 'next-2-weeks', label: 'Next 2 weeks' },
  { value: 'next-month', label: 'Next month' },
  { value: 'flexible', label: 'Flexible' },
] as const

/**
 * GTM tracking for the clinic consultation form, per Pawan's spec. Scoped to
 * kind === 'clinic' only for now — the provider form is getting its own
 * booking flow later, at which point it needs its own event wiring.
 */
function pushConsultationSubmit(args: {
  clinicName: string
  clinicId: number
  treatmentInterest: string
  preferredDateRange: string
  loginStatus: 'guest' | 'logged-in'
}) {
  const dateLabel =
    DATE_RANGE_OPTIONS.find((o) => o.value === args.preferredDateRange)?.label || 'Flexible'
  ;(window as any).dataLayer = (window as any).dataLayer || []
  ;(window as any).dataLayer.push({
    event: 'consultation_submit',
    form_name: 'consultation_request',
    clinic_name: args.clinicName,
    clinic_id: String(args.clinicId),
    treatment_interest: args.treatmentInterest || 'Not sure yet',
    preferred_date: dateLabel,
    login_status: args.loginStatus,
    page_location: window.location.href,
  })
}

function pushConsultationSubmitError(args: { clinicName: string; errorMessage: string }) {
  ;(window as any).dataLayer = (window as any).dataLayer || []
  ;(window as any).dataLayer.push({
    event: 'consultation_submit_error',
    form_name: 'consultation_request',
    clinic_name: args.clinicName,
    error_message: args.errorMessage,
  })
}

export function ConsultationForm({
  kind,
  targetId,
  targetName,
  servicesOffered = [],
  active,
  className = 'space-y-4',
  onSuccess,
}: {
  kind: BookingKind
  targetId: number
  targetName: string
  servicesOffered?: TreatmentOption[]
  active: boolean
  className?: string
  onSuccess?: () => void
}) {
  const [state, setState] = useState<FormState>('idle')
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [turnstileReady, setTurnstileReady] = useState(false)
  /**
   * Whether the visitor has touched this form.
   *
   * The clinic page renders this form with `active` hard-coded, so the 475KB
   * Turnstile script loaded on every clinic page view even though almost nobody
   * books. Gating the script effect on engagement moves that cost to the moment
   * someone actually starts filling the form in. BookingModal already passes
   * `active={open}` and is unaffected either way.
   */
  const [engaged, setEngaged] = useState(false)
  // Mirrors turnstileReady for the async submit path, where the state value
  // captured by the closure would be stale.
  const turnstileReadyRef = useRef(false)
  const [loginStatus, setLoginStatus] = useState<'guest' | 'logged-in'>('guest')
  const turnstileContainerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<string | number | undefined>(undefined)
  const tokenResolverRef = useRef<((token?: string) => void) | null>(null)
  const warnedMissingKeyRef = useRef(false)

  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

  useEffect(() => {
    if (!active) {
      setState('idle')
      setErrorMsg('')
      setFieldErrors({})
      return
    }
    // Client-side only, on purpose: this page is ISR-cached and shared across
    // every visitor, so auth state can never be resolved server-side here
    // without breaking the cache. /api/users/me always returns 200 with
    // { user: null } when signed out, so this is a safe fire-and-forget check.
    let cancelled = false
    fetch('/api/users/me', { credentials: 'include' })
      .then((res) => res.json())
      .then((json) => {
        if (!cancelled) setLoginStatus(json?.user ? 'logged-in' : 'guest')
      })
      .catch(() => { /* default 'guest' stands */ })
    return () => { cancelled = true }
  }, [active])

  useEffect(() => {
    turnstileReadyRef.current = turnstileReady
  }, [turnstileReady])

  useEffect(() => {
    // `engaged` is the addition: no engagement, no 475KB script.
    if (!active || !engaged) return
    if (!siteKey) {
      if (!warnedMissingKeyRef.current) {
        console.warn('[booking] NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set. Rendering booking form without Turnstile.')
        warnedMissingKeyRef.current = true
      }
      return
    }
    if (!turnstileContainerRef.current) return

    const renderWidget = () => {
      if (!turnstileContainerRef.current || widgetRef.current !== undefined) return
      const turnstile = (window as any).turnstile
      if (!turnstile) return
      widgetRef.current = turnstile.render(turnstileContainerRef.current, {
        sitekey: siteKey,
        execution: 'execute',
        appearance: 'execute',
        callback: (token: string) => {
          tokenResolverRef.current?.(token)
          tokenResolverRef.current = null
        },
        'expired-callback': () => {
          tokenResolverRef.current?.(undefined)
          tokenResolverRef.current = null
        },
        'error-callback': () => {
          tokenResolverRef.current?.(undefined)
          tokenResolverRef.current = null
        },
      })
      setTurnstileReady(true)
    }

    if ((window as any).turnstile) {
      renderWidget()
      return
    }

    const existing = document.querySelector('script[src*="challenges.cloudflare.com/turnstile"]') as HTMLScriptElement | null
    if (!existing) {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.onload = renderWidget
      document.head.appendChild(script)
      return
    }

    existing.addEventListener('load', renderWidget)
    return () => existing.removeEventListener('load', renderWidget)
  }, [active, engaged, siteKey])

  useEffect(() => {
    return () => {
      if (widgetRef.current !== undefined && (window as any).turnstile) {
        ;(window as any).turnstile.remove(widgetRef.current)
        widgetRef.current = undefined
      }
    }
  }, [])

  if (!active) return null

  async function getTurnstileToken(): Promise<string | undefined> {
    if (!siteKey) return undefined

    // With the script deferred until engagement, a submit can arrive before the
    // widget has finished rendering -- most likely on an autofilled form, where
    // no field was ever focused. Submitting IS engagement, so engage and wait
    // rather than failing the visitor's booking. Ten seconds matches the token
    // timeout below; past that the original not-ready error still applies.
    if (!turnstileReadyRef.current) {
      setEngaged(true)
      const start = Date.now()
      while (!turnstileReadyRef.current && Date.now() - start < 10000) {
        await new Promise((r) => setTimeout(r, 100))
      }
    }

    const turnstile = (window as any).turnstile
    if (!turnstile || widgetRef.current === undefined || !turnstileReadyRef.current) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('[booking] Turnstile is not ready. Continuing in development mode.')
        return undefined
      }
      throw new Error('Turnstile is not ready. Please try again.')
    }

    // Reset before every execute. The widget renders once and is not unmounted
    // between opens/closes of the modal, so without this a second submission in
    // the same session reuses an already-consumed widget -- Cloudflare rejects
    // that with an internal "provide 2 parameters" error instead of a token.
    try {
      turnstile.reset(widgetRef.current)
    } catch { /* widget may not need resetting yet -- safe to ignore */ }

    return await new Promise<string | undefined>((resolve) => {
      tokenResolverRef.current = resolve
      try {
        turnstile.execute(turnstileContainerRef.current)
      } catch (error) {
        tokenResolverRef.current = null
        if (process.env.NODE_ENV !== 'production') {
          console.warn('[booking] Turnstile execution failed. Continuing in development mode.', error)
          resolve(undefined)
          return
        }
        throw error
      }
      window.setTimeout(() => {
        if (tokenResolverRef.current) {
          tokenResolverRef.current(undefined)
          tokenResolverRef.current = null
        }
      }, 10000)
    }).then((token) => {
      if (!token && process.env.NODE_ENV !== 'production') {
        console.warn('[booking] Turnstile did not return a token. Continuing in development mode.')
        return undefined
      }
      return token
    })
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setState('submitting')
    setErrorMsg('')
    setFieldErrors({})

    const form = event.currentTarget
    const formData = new FormData(form)
    const selectedServiceId = Number(formData.get('serviceId') || 0)
    const selectedService = servicesOffered.find((t) => t.id === selectedServiceId)

    try {
      const turnstileToken = await getTurnstileToken()
      const body = {
        kind,
        targetId,
        targetName,
        patientName: String(formData.get('patientName') || ''),
        patientEmail: String(formData.get('patientEmail') || ''),
        patientPhone: String(formData.get('patientPhone') || ''),
        serviceId: selectedServiceId > 0 ? selectedServiceId : undefined,
        serviceName: selectedService?.name || '',
        preferredDateRange: String(formData.get('preferredDateRange') || 'flexible'),
        message: String(formData.get('message') || ''),
        turnstileToken,
        _hp: String(formData.get('website') || ''),
      }

      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) {
        setState('idle')
        setFieldErrors(json.fieldErrors || {})
        const message = json.error || 'Please try again.'
        setErrorMsg(message)
        if (kind === 'clinic') {
          pushConsultationSubmitError({ clinicName: targetName, errorMessage: message })
        }
        return
      }

      setState('success')
      form.reset()
      track('booking_submit', { entityType: kind, entityId: targetId })
      if (kind === 'clinic') {
        pushConsultationSubmit({
          clinicName: targetName,
          clinicId: targetId,
          treatmentInterest: selectedService?.name || '',
          preferredDateRange: body.preferredDateRange,
          loginStatus,
        })
      }
      onSuccess?.()
    } catch (error) {
      const message = (error as Error)?.message || 'Please try again.'
      setState('idle')
      setErrorMsg(message)
      if (kind === 'clinic') {
        pushConsultationSubmitError({ clinicName: targetName, errorMessage: message })
      }
    }
  }

  if (state === 'success') {
    return (
      <div className="px-2 py-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent-soft text-brand-accent">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="font-serif text-h3 text-ink-primary">Request sent.</h3>
        <p className="mt-2 text-body-sm text-ink-secondary">
          The clinic will reach out by email within 1-2 days.
        </p>
      </div>
    )
  }

  return (
    // onFocusCapture: touching any field starts loading the challenge, so it is
    // ready long before the visitor has finished filling the form in.
    <form onSubmit={handleSubmit} onFocusCapture={() => setEngaged(true)} noValidate className={className}>
      <input name="website" type="text" tabIndex={-1} style={{ display: 'none' }} autoComplete="off" aria-hidden="true" />

      <Field label="Name" required error={fieldErrors.patientName} hint="required">
        <input name="patientName" type="text" autoComplete="name" required className={inputClass(fieldErrors.patientName)} />
      </Field>

      <Field label="Email" required error={fieldErrors.patientEmail} hint="email">
        <input name="patientEmail" type="email" autoComplete="email" required className={inputClass(fieldErrors.patientEmail)} />
      </Field>

      <Field label="Phone" optional error={fieldErrors.patientPhone}>
        <input name="patientPhone" type="tel" autoComplete="tel" className={inputClass(fieldErrors.patientPhone)} />
      </Field>

      <Field label="Treatment of interest" error={fieldErrors.serviceId}>
        <select name="serviceId" defaultValue="0" className={inputClass(fieldErrors.serviceId)}>
          <option value="0">Not sure yet</option>
          {servicesOffered.map((treatment) => (
            <option key={`${treatment.id}-${treatment.name}`} value={treatment.id}>
              {treatment.name}
            </option>
          ))}
        </select>
      </Field>

      <fieldset>
        <legend className="mb-2 block text-body-sm font-medium text-ink-primary">Preferred date range</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {DATE_RANGE_OPTIONS.map((option) => (
            <label
              key={option.value}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-control border border-border px-3 py-2 text-body-sm text-ink-secondary transition hover:border-brand-accent"
            >
              <input
                name="preferredDateRange"
                type="radio"
                value={option.value}
                defaultChecked={option.value === 'flexible'}
                className="h-4 w-4 accent-brand-accent"
              />
              {option.label}
            </label>
          ))}
        </div>
        {fieldErrors.preferredDateRange && (
          <p className="mt-1 text-caption text-state-error">{fieldErrors.preferredDateRange}</p>
        )}
      </fieldset>

      <Field label="Message" optional error={fieldErrors.message}>
        <textarea name="message" rows={3} className={`${inputClass(fieldErrors.message)} resize-none`} />
      </Field>

      <div ref={turnstileContainerRef} className="min-h-0" aria-hidden="true" />

      <p className="text-caption text-ink-tertiary">We pass your request to the clinic. No payment is taken.</p>

      {errorMsg && (
        <p role="alert" className="rounded-control border border-state-error/20 bg-state-error/5 px-4 py-3 text-body-sm text-state-error">
          {errorMsg}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'submitting'}
        className="flex min-h-11 w-full items-center justify-center rounded-control bg-brand-primary px-5 py-3 text-body-sm font-semibold text-surface-canvas transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {state === 'submitting' ? 'Sending...' : 'Send request'}
      </button>
    </form>
  )
}

function Field({
  label,
  required,
  optional,
  error,
  hint,
  children,
}: {
  label: string
  required?: boolean
  optional?: boolean
  error?: string
  /** Inline hint shown by CSS once the field is :user-invalid (QA T8-01). */
  hint?: 'required' | 'email'
  children: ReactNode
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-body-sm font-medium text-ink-primary">
        {label}
        {required && <span className="text-state-error"> *</span>}
        {optional && <span className="ml-1 text-caption font-normal text-ink-tertiary">optional</span>}
      </span>
      {children}
      {/* The server's message wins; otherwise the CSS-driven hint. */}
      {error ? <span className="mt-1 block text-caption text-state-error">{error}</span> : hint && <FieldHint kind={hint} />}
    </label>
  )
}

function inputClass(error?: string): string {
  return `w-full rounded-control border bg-surface-canvas px-3.5 py-2.5 text-base text-ink-primary transition focus:border-brand-accent focus:outline-none ${
    error ? 'border-state-error' : 'border-border'
  }`
}
