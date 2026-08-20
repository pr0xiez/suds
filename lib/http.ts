import type { NextRequest } from 'next/server'

/**
 * Cheap CSRF guard for mutating route handlers (Server Actions carry their own
 * origin check). Browsers send Origin on cross-site form posts; when present it
 * must match the request host. Absent Origin (curl, some same-origin posts)
 * passes — the sameSite=lax session cookie is the primary defence.
 */
export function sameOriginOk(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return true
  try {
    return new URL(origin).host === req.headers.get('host')
  } catch {
    return false
  }
}
