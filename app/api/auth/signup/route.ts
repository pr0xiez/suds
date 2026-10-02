import type { NextRequest } from 'next/server'
import { registerAccount, registrationProblems } from '@/lib/auth/accounts'
import { type AuthErrorCode, AuthFormError, authErrorParam } from '@/lib/auth/formErrors'
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
    const input = {
      kind,
      email,
      name: formText(form, 'name'),
      password: formText(form, 'password'),
      businessName: formText(form, 'businessName'),
      signupCode: formText(form, 'signupCode'),
      next,
    }
    // Typos are reported before the per-email budget is spent on them.
    const problems: AuthErrorCode[] = registrationProblems(input)
    if (input.password !== formText(form, 'confirmPassword')) problems.push('password_mismatch')
    const [problem, ...more] = problems
    if (problem) throw new AuthFormError(problem, ...more)
    if (!(await consumeRateLimit(`signup-email:${email}`, 3, 60 * 60_000)))
      throw new AuthFormError('rate')
    const user = await registerAccount(input)
    const token = await createSessionRecord(user.id)
    const res = authRedirect(req, '/verify', { next })
    res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions())
    return res
  } catch (err) {
    return authRedirect(req, '/signup', { kind, next, error: authErrorParam(err) })
  }
}
