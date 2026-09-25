'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { PasswordField } from './PasswordField'
import { FieldHint } from '@/components/shared/FieldHint'

export function LoginForm({ redirect }: { redirect?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const errorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.errors?.[0]?.message || 'Invalid email or password.')
        setLoading(false)
        return
      }

      const data = await res.json()
      const role = data?.user?.role

      // Hard navigation so the persistent layout (header + SavedItemsProvider)
      // remounts: the header shows the logged-in state and any anonymous
      // localStorage saves migrate into the account.
      let dest = redirect || '/'
      if (!redirect) {
        if (role === 'user') dest = '/dashboard'
        else if (role === 'clinic') dest = '/dashboard/clinic'
        else if (role === 'brand') dest = '/dashboard/brand'
        else if (role === 'admin' || role === 'editor') dest = '/admin'
        else dest = '/dashboard'
      }
      window.location.assign(dest)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Honeypot: hidden from humans, filled by bots */}
      <input name="website" type="text" style={{ display: 'none' }} tabIndex={-1} autoComplete="off" aria-hidden="true" />
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
        id="password"
        label="Password"
        value={password}
        onChange={setPassword}
        autoComplete="current-password"
        rightSlot={
          <Link href="/forgot-password" className="text-caption text-brand-accent hover:underline">
            Forgot password?
          </Link>
        }
      />

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-sm border border-state-error/30 bg-state-error/10 p-3 text-sm text-state-error"
          tabIndex={-1}
          ref={errorRef}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-brand-primary text-surface-canvas rounded-control py-3 text-body-sm font-semibold hover:opacity-90 transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2"
      >
        {loading ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  )
}
