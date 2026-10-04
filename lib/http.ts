import type { NextRequest } from 'next/server'

/**
 * Cheap CSRF guard for mutating route handlers (Server Actions carry their own
 * origin check). Browsers send Origin on cross-site form posts; when present it
 * must match the request host. Without Origin (curl, some same-origin posts)
 * the browser's own Sec-Fetch-Site verdict decides; a client that sends neither
 * is not a browser carrying a victim's sameSite=lax session cookie.
 */
export function sameOriginOk(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return req.headers.get('sec-fetch-site') !== 'cross-site'
  try {
    return new URL(origin).host === req.headers.get('host')
  } catch {
    return false
  }
}

/**
 * Rate-limit key for the caller. Only entries appended by our own proxies are
 * trustworthy: the client controls everything to their left. Vercel replaces
 * the header, so the default of one trusted hop reads the address it recorded;
 * raise TRUSTED_PROXY_HOPS when more proxies of ours sit in front.
 */
export function clientIp(req: Request): string {
  const hops = Math.max(1, Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '', 10) || 1)
  const chain = (req.headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
  return chain[Math.max(0, chain.length - hops)] ?? 'local'
}

/**
 * True when the body declares a size within the cap. A request without
 * Content-Length (chunked) is refused: parsing it would buffer an unbounded
 * body, and browsers always declare the length of a form post.
 */
export function declaredBodyWithin(req: Request, maxBytes: number): boolean {
  const raw = req.headers.get('content-length')
  if (!raw || !/^\d+$/.test(raw)) return false
  return Number(raw) <= maxBytes
}
