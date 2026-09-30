import type { NextRequest } from 'next/server'
import { requestPasswordReset } from '@/lib/auth/accounts'
import { authForm, authRedirect, formText } from '@/lib/auth/forms'
import { consumeRateLimit } from '@/lib/auth/persistentRateLimit'

export async function POST(req: NextRequest) {
  try {
    const form = await authForm(req, 'recover', 6)
    const email = formText(form, 'email').trim().toLowerCase()
    if (await consumeRateLimit(`recovery-email:${email}`, 3, 60 * 60_000))
      await requestPasswordReset(email)
  } catch {
    /* Same result regardless of account existence, provider setup, or throttling. */
  }
  return authRedirect(req, '/recover', { sent: '1' })
}
