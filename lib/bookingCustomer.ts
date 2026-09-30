import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'

/** A customer can also own a business; portal access never uses the active owner business. */
export async function requirePortalUser(next = '/portal') {
  const user = await getSessionUser()
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`)
  if (!user.emailVerifiedAt) redirect(`/verify?next=${encodeURIComponent(next)}`)
  return user
}
