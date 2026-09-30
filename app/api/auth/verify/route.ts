import type { NextRequest } from 'next/server'
import { consumeAccountToken } from '@/lib/auth/accounts'
import { authForm, authRedirect, formText } from '@/lib/auth/forms'
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth/session'
import { safeAuthNext } from '@/lib/business'

export async function POST(req: NextRequest) {
  const rawToken = ''
  let next = '/dashboard'
  try {
    const form = await authForm(req, 'verify', 12)
    next = safeAuthNext(formText(form, 'next'))
    await consumeAccountToken(
      formText(form, 'token'),
      formText(form, 'password') || undefined,
      'VERIFY',
    )
    const res = authRedirect(req, '/login', { next, verified: '1' })
    // A verification link never switches the current session into another identity.
    res.cookies.set(SESSION_COOKIE_NAME, '', { ...sessionCookieOptions(), maxAge: 0 })
    return res
  } catch {
    return authRedirect(req, '/verify', { error: '1', next, token: rawToken })
  }
}
