'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PasswordField } from './PasswordField'
import { useTurnstile } from '@/components/shared/useTurnstile'
import { FieldHint } from '@/components/shared/FieldHint'

export function SignupForm({ redirect }: { redirect?: string }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { token: turnstileToken, containerRef: turnstileRef, reset: resetTurnstile, siteKey } = useTurnstile()

  // Step 2: email verification. Signup no longer logs the user in directly --
  // it only creates the account and emails a 6-digit code (see
  // app/api/auth/signup/route.ts). The account stays unusable (beforeLogin
  // hook on the Users collection blocks it) until that code is confirmed here.
  const [needsVerification, setNeedsVerification] = useState(false)
  const [code, setCode] = useState('')
  const [verifyError, setVerifyError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [resendMsg, setResendMsg] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, cfTurnstileToken: turnstileToken || undefined }),
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || data.fieldErrors?.password || data.fieldErrors?.email || 'Could not create your account.')
        resetTurnstile()
        setLoading(false)
        return
      }

      setNeedsVerification(true)
      setLoading(false)
    } catch {
      setError('Something went wrong. Please try again.')
      resetTurnstile()
      setLoading(false)
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    setVerifyError('')
    setVerifying(true)

    try {
      const res = await fetch('/api/auth/verify-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setVerifyError(data.error || 'Invalid or expired code. Please try again.')
        setVerifying(false)
        return
      }

      // Verified. Log in to set the session cookie, then hard-navigate so the
      // layout remounts (header updates, localStorage saves migrate).
      const loginRes = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })
      if (!loginRes.ok) {
        window.location.assign('/login')
        return
      }
      window.location.assign(redirect || '/profile')
    } catch {
      setVerifyError('Something went wrong. Please try again.')
      setVerifying(false)
    }
  }

  async function handleResend() {
    setResendMsg('')
    setVerifyError('')
    setResending(true)
    try {
      const res = await fetch('/api/auth/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      setResendMsg(res.ok ? 'A new code is on its way.' : 'Could not resend the code. Please try again.')
    } catch {
      setResendMsg('Could not resend the code. Please try again.')
    } finally {
      setResending(false)
    }
  }

  if (needsVerification) {
    return (
      <form onSubmit={handleVerify} className="space-y-5">
        <div>
          <p className="text-body-sm text-ink-secondary mb-4">
            We sent a 6-digit code to <span className="font-medium text-ink-primary">{email}</span>. Enter it below to
            finish creating your account.
          </p>
          <label htmlFor="code" className="block text-body-sm font-medium text-ink-primary mb-1.5">
            Verification code
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            pattern="\d{6}"
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            required
            autoComplete="one-time-code"
            placeholder="123456"
            className="w-full px-4 py-3 rounded-md border border-border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body-sm tracking-widest text-center text-h4"
          />
        </div>

        {verifyError && (
          <p className="text-body-sm text-[#B91C1C] bg-[#B91C1C]/5 px-4 py-3 rounded-md border border-[#B91C1C]/20">
            {verifyError}
          </p>
        )}

        <button
          type="submit"
          disabled={verifying || code.length !== 6}
          className="w-full bg-brand-primary text-surface-canvas rounded-control py-3 text-body-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
        >
          {verifying ? 'Verifying...' : 'Verify and continue'}
        </button>

        <p className="text-caption text-ink-tertiary text-center">
          Didn&apos;t get it?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={resending}
            className="text-brand-accent hover:underline disabled:opacity-50"
          >
            {resending ? 'Sending...' : 'Resend code'}
          </button>
          {resendMsg && <span className="block mt-1">{resendMsg}</span>}
        </p>
      </form>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="name" className="block text-body-sm font-medium text-ink-primary mb-1.5">
          Full name
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoComplete="name"
          placeholder="Your name"
          className="w-full px-4 py-3 rounded-md border border-border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body-sm"
        />
        <FieldHint />
      </div>

      <div>
        <label htmlFor="email" className="block text-body-sm font-medium text-ink-primary mb-1.5">
          Email address
        </label>
        <input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          placeholder="you@email.com"
          className="w-full px-4 py-3 rounded-md border border-border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body-sm"
        />
        <FieldHint kind="email" />
      </div>

      <PasswordField
        id="new-password"
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        minLength={8}
        placeholder="At least 8 characters"
      />

      {siteKey && (
        <div>
          <div ref={turnstileRef} />
        </div>
      )}

      {error && (
        <p className="text-body-sm text-[#B91C1C] bg-[#B91C1C]/5 px-4 py-3 rounded-md border border-[#B91C1C]/20">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-primary text-surface-canvas rounded-control py-3 text-body-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
      >
        {loading ? 'Creating your account...' : 'Create account'}
      </button>

      <p className="text-caption text-ink-tertiary text-center">
        By creating an account you agree to our{' '}
        <Link href="/terms" className="text-brand-accent hover:underline">Terms</Link> and{' '}
        <Link href="/privacy" className="text-brand-accent hover:underline">Privacy Policy</Link>.
      </p>
    </form>
  )
}
