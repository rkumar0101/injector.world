/**
 * Inline validation hint for a form field (2026-09-25, QA T8-01).
 *
 * Pure markup: it is hidden by default and CSS in app/globals.css shows it once
 * the field before it (or a field inside the same `.field` wrapper) is
 * :user-invalid, i.e. after the visitor has touched it or tried to submit.
 * No state, no effects, nothing that can disagree between server and client.
 */
export function FieldHint({
  kind = 'required',
  onDark = false,
  children,
}: {
  kind?: 'required' | 'email' | 'password'
  onDark?: boolean
  children?: React.ReactNode
}) {
  const text =
    children ??
    (kind === 'email'
      ? 'Please enter a valid email address.'
      : kind === 'password'
        ? 'Please enter your password.'
        : 'This field is required.')
  // A span, not a p: it also sits inside <label> wrappers (the booking form),
  // where only phrasing content is valid. CSS makes it block when shown.
  return <span className={`field-error${onDark ? ' field-error-on-dark' : ''}`}>{text}</span>
}
