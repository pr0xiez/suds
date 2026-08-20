import { type NextRequest, NextResponse } from 'next/server'
import { verifyPassword } from '@/lib/auth/password'
import { allowAttempt, resetAttempts } from '@/lib/auth/rateLimit'
import { createSessionRecord, SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { sameOriginOk } from '@/lib/http'

// A structurally valid hash that matches no password — verified when the email
// is unknown so response time doesn't reveal which emails exist.
const DECOY_HASH = `scrypt$16384$8$1$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(64).toString('base64')}`

export async function POST(req: NextRequest) {
  const fail = (code: string) =>
    NextResponse.redirect(new URL(`/login?error=${code}`, req.url), 303)

  if (!sameOriginOk(req)) return fail('1')

  const form = await req.formData()
  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase()
  const password = String(form.get('password') ?? '')
  if (!email || !password) return fail('1')

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  const rateKey = `${ip}:${email}`
  if (!allowAttempt(rateKey)) return fail('rate')

  const user = await prisma.user.findUnique({ where: { email } })
  const ok = await verifyPassword(password, user?.passwordHash ?? DECOY_HASH)
  if (!user?.active || !ok) return fail('1')

  resetAttempts(rateKey)
  const token = await createSessionRecord(user.id)
  const res = NextResponse.redirect(new URL('/dashboard', req.url), 303)
  res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions())
  return res
}
