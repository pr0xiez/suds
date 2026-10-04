import type { NextConfig } from 'next'

const isDev = process.env.NODE_ENV === 'development'

// Private media is displayed from, and uploaded straight to, the object-storage
// origin. Header rules are fixed at build time, so S3_ENDPOINT (an origin, not a
// secret) must be present in the build environment for media to load.
function storageOrigin() {
  try {
    const url = new URL(process.env.S3_ENDPOINT ?? '')
    return url.protocol === 'https:' ? ` ${url.origin}` : ''
  } catch {
    return ''
  }
}
const storage = storageOrigin()

// No nonces: they would force every page dynamic through a proxy. React escapes
// rendered text, so the policy's job is to pin where scripts, media, forms and
// fetches may go if something is ever injected.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' blob: data:${storage}`,
  `media-src 'self' blob:${storage}`,
  `connect-src 'self'${storage}`,
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  // No page has a reason to be framed. Server Actions' same-origin check does not
  // stop a same-origin click coming from inside an attacker's iframe.
  "frame-ancestors 'none'",
].join('; ')

const config: NextConfig = {
  // TypeScript 5's compiler API avoids a child-CLI stdout issue in this WSL
  // workspace. Build-time checking remains enabled, as does the typecheck gate.
  experimental: { useTypeScriptCli: false },
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Account links carry one-use tokens in the query string; never send a
          // path or query to another origin.
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
        ],
      },
    ]
  },
}

export default config
