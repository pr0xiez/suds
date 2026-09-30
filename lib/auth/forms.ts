import { type NextRequest, NextResponse } from 'next/server'
import { consumeRateLimit } from '@/lib/auth/persistentRateLimit'
import { sameOriginOk } from '@/lib/http'

export async function authForm(req: NextRequest, action: string, max = 8): Promise<FormData> {
  if (!sameOriginOk(req)) throw new Error('Invalid request origin')
  const length = Number(req.headers.get('content-length') ?? 0)
  if (length > 16_384) throw new Error('Request is too large')
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'local'
  if (!(await consumeRateLimit(`auth:${action}:${ip}`, max)))
    throw new Error('Too many attempts. Try again later.')
  return req.formData()
}

export function authRedirect(req: NextRequest, path: string, params?: Record<string, string>) {
  const url = new URL(path, req.url)
  for (const [key, value] of Object.entries(params ?? {}))
    if (value) url.searchParams.set(key, value)
  return NextResponse.redirect(url, 303)
}

export function formText(form: FormData, name: string): string {
  const value = form.get(name)
  return typeof value === 'string' ? value : ''
}
