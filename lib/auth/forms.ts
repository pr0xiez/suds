import { type NextRequest, NextResponse } from 'next/server'
import { AuthFormError } from '@/lib/auth/formErrors'
import { consumeRateLimit } from '@/lib/auth/persistentRateLimit'
import { clientIp, declaredBodyWithin, sameOriginOk } from '@/lib/http'

export async function authForm(req: NextRequest, action: string, max = 8): Promise<FormData> {
  if (!sameOriginOk(req)) throw new AuthFormError('origin')
  if (!declaredBodyWithin(req, 16_384)) throw new AuthFormError('too_large')
  if (!(await consumeRateLimit(`auth:${action}:${clientIp(req)}`, max)))
    throw new AuthFormError('rate')
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
