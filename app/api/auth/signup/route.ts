import type { NextRequest } from 'next/server'
import { registerAccount } from '@/lib/auth/accounts'
import { authForm, authRedirect, formText } from '@/lib/auth/forms'
import { consumeRateLimit } from '@/lib/auth/persistentRateLimit'
import { createSessionRecord, SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth/session'
import { safeAuthNext } from '@/lib/business'

export async function POST(req: NextRequest) {
  let next = '/dashboard'
  let kind: 'OWNER' | 'CUSTOMER' = 'OWNER'
  try {
    const form = await authForm(req, 'signup', 6)
    kind = formText(form, 'kind') === 'CUSTOMER' ? 'CUSTOMER' : 'OWNER'
    next = safeAuthNext(formText(form, 'next'), kind === 'CUSTOMER' ? '/portal' : '/dashboard')
    const email = formText(form, 'email').trim().toLowerCase()
    if (!(await consumeRateLimit(`signup-email:${email}`, 3, 60 * 60_000)))
      throw new Error('Too many attempts. Try again later.')
    const user = await registerAccount({
      kind,
      email,
      name: formText(form, 'name'),
      password: formText(form, 'password'),
      businessName: formText(form, 'businessName'),
      signupCode: formText(form, 'signupCode'),
      next,
    })
    const token = await createSessionRecord(user.id)
    const res = authRedirect(req, '/verify', { next })
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions())
    return res
  } catch {
    return authRedirect(req, '/signup', { kind, next, error: '1' })
  }
}
