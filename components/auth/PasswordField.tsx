'use client'

import { useState } from 'react'
import { FieldHint } from '@/components/shared/FieldHint'

/**
 * Password input with a show/hide toggle. Shared by login, signup, and reset.
 */
export function PasswordField({
  id,
  value,
  onChange,
  label = 'Password',
  autoComplete = 'current-password',
  placeholder,
  rightSlot,
  minLength,
}: {
  id: string
  value: string
  onChange: (v: string) => void
  label?: string
  autoComplete?: string
  placeholder?: string
  rightSlot?: React.ReactNode
  minLength?: number
}) {
  const [show, setShow] = useState(false)

  return (
    <div className="field">
      <div className="flex items-center justify-between mb-1.5">
        <label htmlFor={id} className="block text-body-sm font-medium text-ink-primary">
          {label}
        </label>
        {rightSlot}
      </div>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required
          minLength={minLength}
          autoComplete={autoComplete}
          placeholder={placeholder}
          className="w-full pl-4 pr-12 py-3 rounded-md border border-border bg-surface-canvas text-ink-primary placeholder-ink-tertiary focus:outline-none focus:ring-2 focus:ring-brand-accent text-body-sm"
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-ink-tertiary hover:text-ink-primary rounded-md transition"
        >
          {show ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      <FieldHint kind="password">
        {minLength ? `Please enter a password of at least ${minLength} characters.` : undefined}
      </FieldHint>
    </div>
  )
}
