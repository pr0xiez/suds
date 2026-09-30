import type { NextRequest } from 'next/server'
import { createBusinessForUser } from '@/lib/auth/accounts'
import { authForm, authRedirect, formText } from '@/lib/auth/forms'
import { consumeRateLimit } from '@/lib/auth/persistentRateLimit'
import { getSessionUser } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  try {
    const form = await authForm(req, 'new-business', 5)
    const user = await getSessionUser()
    if (
      !user?.emailVerifiedAt ||
      !(await consumeRateLimit(`new-business:${user.id}`, 3, 24 * 60 * 60_000))
    )
      throw new Error('Verify your account first')
    const business = await createBusinessForUser(
      user.id,
      formText(form, 'businessName'),
      formText(form, 'signupCode'),
    )
    const res = authRedirect(req, '/onboarding')
    res.cookies.set('suds_business', business.id, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    })
    return res
  } catch {
    return authRedirect(req, '/new-business', { error: '1' })
  }
}
