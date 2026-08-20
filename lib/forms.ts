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
  return raw.startsWith('/') && !raw.startsWith('//') ? raw : fallback
}

/**
 * Ops throw Errors with user-facing messages. Anything carrying a `code`
 * (Prisma request errors, Node errnos) is infrastructure — don't leak it.
 */
export function friendlyError(err: unknown): string {
  if (err instanceof z.ZodError) {
    return err.issues[0]?.message ?? 'Check the form and try again.'
  }
  if (err instanceof Error && !('code' in err) && err.message) return err.message
  return 'Something went wrong. Try again.'
}
