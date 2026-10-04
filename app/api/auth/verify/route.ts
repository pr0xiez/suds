import type { NextRequest } from 'next/server'
import { consumeAccountToken } from '@/lib/auth/accounts'
import { AuthFormError, authErrorParam } from '@/lib/auth/formErrors'
import { authForm, authRedirect, formText } from '@/lib/auth/forms'
import { getSessionUser, SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth/session'
import { safeAuthNext } from '@/lib/business'

export async function POST(req: NextRequest) {
  let rawToken = ''
  let next = '/dashboard'
  try {
    const form = await authForm(req, 'verify', 12)
    next = safeAuthNext(formText(form, 'next'))
    rawToken = formText(form, 'token')
    const password = formText(form, 'password')
    if (password !== formText(form, 'confirmPassword')) throw new AuthFormError('password_mismatch')
    const session = await getSessionUser()
    await consumeAccountToken(rawToken, password || undefined, 'VERIFY', session?.id ?? null)
    const res = authRedirect(req, '/login', { next, verified: '1' })
    // A verification link never switches the current session into another identity.
    res.cookies.set(SESSION_COOKIE_NAME, '', { ...sessionCookieOptions(), maxAge: 0 })
    return res
  } catch (err) {
    return authRedirect(req, '/verify', { error: authErrorParam(err), next, token: rawToken })
  }
}
