import { type NextRequest, NextResponse } from 'next/server'
import { verifyPassword } from '@/lib/auth/password'
import { consumeRateLimit } from '@/lib/auth/persistentRateLimit'
import { createSessionRecord, SESSION_COOKIE_NAME, sessionCookieOptions } from '@/lib/auth/session'
import { businessUserFor, safeAuthNext } from '@/lib/business'
import { prisma } from '@/lib/db/client'
import { clientIp, declaredBodyWithin, sameOriginOk } from '@/lib/http'

// A structurally valid hash that matches no password — verified when the email
// is unknown so response time doesn't reveal which emails exist.
const DECOY_HASH = `scrypt$16384$8$1$${Buffer.alloc(16).toString('base64')}$${Buffer.alloc(64).toString('base64')}`

export async function POST(req: NextRequest) {
  let next = '/dashboard'
  const fail = (code: string) => {
    const url = new URL('/login', req.url)
    url.searchParams.set('error', code)
    url.searchParams.set('next', next)
    return NextResponse.redirect(url, 303)
  }

  if (!sameOriginOk(req)) return fail('1')

  if (!declaredBodyWithin(req, 16_384)) return fail('1')
  const form = await req.formData()
  next = safeAuthNext(String(form.get('next') ?? ''), '')
  const email = String(form.get('email') ?? '')
    .trim()
    .toLowerCase()
  const password = String(form.get('password') ?? '')
  if (!email || !password) return fail('1')

  const ip = clientIp(req)
  const rateKey = `${ip}:${email}`
  if (
    !(await consumeRateLimit(`login:${rateKey}`)) ||
    !(await consumeRateLimit(`login-ip:${ip}`, 40))
  )
    return fail('rate')

  const user = await prisma.user.findUnique({ where: { email } })
  const ok = await verifyPassword(password, user?.passwordHash ?? DECOY_HASH)
  if (!user?.active || !ok) return fail('1')

  const token = await createSessionRecord(user.id)
  const membership = await businessUserFor(user)
  const destination = user.emailVerifiedAt
    ? safeAuthNext(next, membership ? '/dashboard' : '/portal')
    : `/verify?next=${encodeURIComponent(safeAuthNext(next, membership ? '/dashboard' : '/portal'))}`
  const res = NextResponse.redirect(new URL(destination, req.url), 303)
  res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions())
  return res
}
