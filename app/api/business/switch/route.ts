import { type NextRequest, NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/auth/session'
import { businessUserFor } from '@/lib/business'
import { sameOriginOk } from '@/lib/http'

export async function POST(req: NextRequest) {
  const user = await getSessionUser()
  if (!user?.emailVerifiedAt) return Response.json({ error: 'Sign in first.' }, { status: 401 })
  if (!sameOriginOk(req)) return Response.json({ error: 'Bad origin.' }, { status: 403 })
  const form = await req.formData()
  const businessId = String(form.get('businessId') ?? '')
  const membership = await businessUserFor(user, businessId)
  if (!membership || membership.businessId !== businessId)
    return Response.json({ error: 'Business unavailable.' }, { status: 403 })
  const res = NextResponse.redirect(new URL('/dashboard', req.url), 303)
  res.cookies.set('suds_business', businessId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 30 * 86400,
  })
  return res
}
