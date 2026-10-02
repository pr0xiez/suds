import type { NextRequest } from 'next/server'
import { consumeAccountToken } from '@/lib/auth/accounts'
import { AuthFormError, authErrorParam } from '@/lib/auth/formErrors'
import { authForm, authRedirect, formText } from '@/lib/auth/forms'
import { SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  let rawToken = ''
  try {
    const form = await authForm(req, 'reset', 8)
    rawToken = formText(form, 'token')
    const password = formText(form, 'password')
    if (password !== formText(form, 'confirmPassword')) throw new AuthFormError('password_mismatch')
    await consumeAccountToken(rawToken, password, 'RESET')
    const res = authRedirect(req, '/login', { reset: '1' })
    res.cookies.set(SESSION_COOKIE_NAME, '', { ...sessionCookieOptions(), maxAge: 0 })
    return res
  } catch (err) {
    return authRedirect(req, '/reset-password', { error: authErrorParam(err), token: rawToken })
  }
}
