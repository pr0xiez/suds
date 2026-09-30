import type { NextConfig } from 'next'

const config: NextConfig = {
  // TypeScript 5's compiler API avoids a child-CLI stdout issue in this WSL
  // workspace. Build-time checking remains enabled, as does the typecheck gate.
  experimental: { useTypeScriptCli: false },
  // Internal tool — no page has a reason to be framed. Server Actions' same-origin
  // check does not stop a same-origin click coming from inside an attacker's
  // iframe, so deny framing outright (CSP for modern browsers, XFO for the rest).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'none'" },
        ],
      },
    ]
  },
}

export default config
