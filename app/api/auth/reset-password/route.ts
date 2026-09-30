import type { NextRequest } from 'next/server'
import { consumeAccountToken } from '@/lib/auth/accounts'
import { authForm, authRedirect, formText } from '@/lib/auth/forms'
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  let rawToken = ''
  try {
    const form = await authForm(req, 'reset', 8)
    rawToken = formText(form, 'token')
    await consumeAccountToken(rawToken, formText(form, 'password'), 'RESET')
    const res = authRedirect(req, '/login', { reset: '1' })
    res.cookies.set(SESSION_COOKIE_NAME, '', { ...sessionCookieOptions(), maxAge: 0 })
    return res
  } catch {
    return authRedirect(req, '/reset-password', { error: '1', token: rawToken })
  }
}
