import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { cache } from 'react'
import { prisma } from '@/lib/db/client'
import type { User } from '@/lib/generated/prisma/client'

/**
 * Database-backed sessions: a random bearer token in an httpOnly cookie, its
 * sha256 in the Session table. No JWT dependency, and deleting the row revokes
 * the session immediately — worth the one lookup per request for a tool with a
 * handful of users.
 */

export const SESSION_COOKIE_NAME = 'suds_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE_SECONDS,
  }
}

/**
 * Creates the DB record and returns the raw token for the caller to set as a
 * cookie — route handlers set it on their redirect response, server actions
 * through the cookie store.
 */
export async function createSessionRecord(userId: string): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + MAX_AGE_SECONDS * 1000)
  await prisma.session.create({ data: { tokenHash: hashToken(token), userId, expiresAt } })
  // Opportunistic cleanup so the table doesn't accumulate forever.
  await prisma.session.deleteMany({ where: { userId, expiresAt: { lt: new Date() } } })
  return token
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  store.delete(SESSION_COOKIE_NAME)
}

export const getSessionUser = cache(async (): Promise<User | null> => {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) return null
  if (!session.user.active) return null
  return session.user
})

/** Page/action guard: the signed-in user, or a redirect to /login. */
export async function requireUser(): Promise<User> {
  const user = await getSessionUser()
  if (!user) redirect('/login')
  return user
}

/** Owner-only surfaces (user management). Staff get bounced to the dashboard. */
export async function requireOwner(): Promise<User> {
  const user = await requireUser()
  if (user.role !== 'OWNER') redirect('/dashboard')
  return user
}
