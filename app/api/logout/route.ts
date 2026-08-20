import { createHash } from 'node:crypto'
import { type NextRequest, NextResponse } from 'next/server'
import { SESSION_COOKIE_NAME } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { sameOriginOk } from '@/lib/http'

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL('/login', req.url), 303)
  if (!sameOriginOk(req)) return res

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value
  if (token) {
    const tokenHash = createHash('sha256').update(token).digest('hex')
    await prisma.session.deleteMany({ where: { tokenHash } })
  }
  res.cookies.delete(SESSION_COOKIE_NAME)
  return res
}
