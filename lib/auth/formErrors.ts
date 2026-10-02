/**
 * Account forms post to route handlers that redirect back on failure. The
 * redirect carries short reason codes (never free text) so pages can show
 * exactly what went wrong next to the field it concerns.
 */

const AUTH_ERRORS = {
  origin: { message: 'This form came from an unexpected page. Reload and try again.' },
  too_large: { message: 'The form was too large to process. Shorten your entries and try again.' },
  rate: { message: 'Too many attempts. Wait a few minutes and try again.' },
  name: { field: 'name', message: 'Enter your name.' },
  business_name: { field: 'businessName', message: 'Enter your business name.' },
  email: { field: 'email', message: 'Enter a valid email address, like you@shop.com.' },
  email_taken: {
    field: 'email',
    message: 'An account already uses this email. Sign in or recover your password instead.',
  },
  password_length: { field: 'password', message: 'Use a password with 12 to 128 characters.' },
  password_required: { field: 'password', message: 'Choose a password for your account.' },
  password_mismatch: {
    field: 'confirmPassword',
    message: 'The passwords do not match. Type the same password in both fields.',
  },
  signup_code: { field: 'signupCode', message: 'That pilot invitation code is not valid.' },
  link_invalid: {
    message: 'This link is invalid, expired, or already used. Request a new email and try again.',
  },
  link_revoked: {
    message: 'This invitation was withdrawn by the business. Ask them to send a new one.',
  },
  link_wrong_flow: {
    message: 'This link is for a different step. Open the most recent email we sent you.',
  },
  unverified: { message: 'Verify your email before starting a business.' },
  unknown: { message: 'Something went wrong on our side. Try again in a moment.' },
} as const satisfies Record<string, { field?: AuthErrorField; message: string }>

export type AuthErrorCode = keyof typeof AUTH_ERRORS
export type AuthErrorField =
  | 'name'
  | 'businessName'
  | 'email'
  | 'password'
  | 'confirmPassword'
  | 'signupCode'

const isCode = (value: string): value is AuthErrorCode => Object.hasOwn(AUTH_ERRORS, value)

/**
 * The property is `reasons`, not `code`: `friendlyError` treats anything with
 * a `code` as infrastructure, and these messages are meant for people.
 */
export class AuthFormError extends Error {
  readonly reasons: AuthErrorCode[]
  constructor(...reasons: [AuthErrorCode, ...AuthErrorCode[]]) {
    super(reasons.map((reason) => AUTH_ERRORS[reason].message).join(' '))
    this.name = 'AuthFormError'
    this.reasons = reasons
  }
}

/** Codes for the redirect query; anything unexpected stays generic. */
export function authErrorParam(err: unknown): string {
  return err instanceof AuthFormError ? err.reasons.join(',') : 'unknown'
}

export type AuthErrors = {
  /** Messages not tied to one input, shown in the banner. */
  form: string[]
  fields: Partial<Record<AuthErrorField, string>>
}

/** Parses `?error=` into banner and per-field messages. Legacy `1` reads as unknown. */
export function readAuthErrors(raw: string | undefined): AuthErrors {
  const result: AuthErrors = { form: [], fields: {} }
  if (!raw) return result
  const codes = [...new Set(raw.split(',').map((code) => (isCode(code) ? code : 'unknown')))]
  for (const code of codes) {
    const entry: { field?: AuthErrorField; message: string } = AUTH_ERRORS[code]
    if (entry.field) result.fields[entry.field] ??= entry.message
    else result.form.push(entry.message)
  }
  return result
}

/** One banner line: form-level messages, or a pointer to the fields below. */
export function authBannerMessage(errors: AuthErrors): string | null {
  const fieldCount = Object.keys(errors.fields).length
  if (errors.form.length) return errors.form.join(' ')
  if (fieldCount === 1) return 'Fix the field marked below, then try again.'
  if (fieldCount > 1) return `Fix the ${fieldCount} fields marked below, then try again.`
  return null
}
