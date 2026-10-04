import { z } from 'zod'

/** FormData plumbing shared by the server actions. */

export function fdString(fd: FormData, key: string): string {
  const value = fd.get(key)
  return typeof value === 'string' ? value : ''
}

export function fdStrings(fd: FormData, key: string): string[] {
  return fd.getAll(key).filter((value): value is string => typeof value === 'string')
}

/** Redirect targets that ride in hidden form fields must stay on-site. */
export function safeBackPath(raw: string, fallback: string): string {
  // Browsers read `/\host` and a path with an embedded tab or newline as `//host`.
  const offSite =
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.includes('\\') ||
    Array.from(raw).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
  return offSite ? fallback : raw
}

const fieldLabel = (key: PropertyKey) => {
  const words = String(key)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * Schema messages written for people pass through. Zod's generic defaults
 * ("Too big: expected string ...") are reworded to name the field.
 */
function issueMessage(issue: z.core.$ZodIssue): string {
  const key = [...issue.path].reverse().find((part) => typeof part === 'string')
  const generic = /^(Too big|Too small|Invalid)\b/.test(issue.message)
  if (!generic || key === undefined) return issue.message.trim()
  const label = fieldLabel(key)
  if (issue.code === 'too_big') {
    const max = Number(issue.maximum)
    if (issue.origin === 'string') return `${label} can be at most ${max} characters`
    if (issue.origin === 'array' || issue.origin === 'set') return `${label}: choose at most ${max}`
    return `${label} must be ${max} or less`
  }
  if (issue.code === 'too_small') {
    const min = Number(issue.minimum)
    if (issue.origin === 'string')
      return min <= 1 ? `${label} is required` : `${label} needs at least ${min} characters`
    if (issue.origin === 'array' || issue.origin === 'set')
      return min <= 1 ? `${label}: choose at least one` : `${label}: choose at least ${min}`
    return `${label} must be at least ${min}`
  }
  return `${label} is not valid`
}

const GENERIC_ERROR = 'Something went wrong. Try again.'

/**
 * Ops throw plain Errors with user-facing messages. Anything carrying a `code`
 * (Prisma request errors, Node errnos) or its own error class (Prisma
 * validation or connection failures, SyntaxError, TypeError) is infrastructure
 * and may name hosts or echo payloads; don't leak it.
 */
export function friendlyError(err: unknown): string {
  if (err instanceof z.ZodError) {
    // Every problem at once, so one resubmit can fix them all.
    const messages = [...new Set(err.issues.map(issueMessage))]
      .filter(Boolean)
      .map((message) => (/[.!?]$/.test(message) ? message : `${message}.`))
    return messages.length ? messages.join(' ') : 'Check the form and try again.'
  }
  const deliberate = err instanceof Error && (err.name === 'Error' || err.name === 'AuthFormError')
  if (deliberate && !('code' in err) && err.message) return err.message
  return GENERIC_ERROR
}

/** friendlyError for JSON routes, which supply their own generic fallback. */
export function userFacingError(err: unknown, fallback: string): string {
  const message = friendlyError(err)
  return message === GENERIC_ERROR ? fallback : message
}
