import type { NextRequest } from 'next/server'
import { resendVerification } from '@/lib/auth/accounts'
import { authForm, authRedirect, formText } from '@/lib/auth/forms'
import { consumeRateLimit } from '@/lib/auth/persistentRateLimit'
import { getSessionUser } from '@/lib/auth/session'
import { safeAuthNext } from '@/lib/business'

export async function POST(req: NextRequest) {
  let next = '/dashboard'
  try {
    const form = await authForm(req, 'resend', 5)
    next = safeAuthNext(formText(form, 'next'))
    const user = await getSessionUser()
    if (user && (await consumeRateLimit(`verification:${user.id}`, 3, 60 * 60_000)))
      await resendVerification(user.id, next)
  } catch {
    /* Generic response avoids identity or rate-limit disclosure. */
  }
  return authRedirect(req, '/verify', { sent: '1', next })
}
