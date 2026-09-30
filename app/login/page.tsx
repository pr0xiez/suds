import Link from 'next/link'
import { redirect } from 'next/navigation'
import { btnPrimary, Field, inputClass } from '@/components/ui'
import { getSessionUser } from '@/lib/auth/session'
import { businessUserFor, safeAuthNext } from '@/lib/business'

const ERRORS: Record<string, string> = {
  '1': 'Wrong email or password.',
  rate: 'Too many attempts — wait a few minutes and try again.',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; verified?: string; reset?: string }>
}) {
  const user = await getSessionUser()
  const { error, next: rawNext, verified, reset } = await searchParams
  const membership = user ? await businessUserFor(user) : null
  const next = safeAuthNext(rawNext, membership ? '/dashboard' : '/portal')
  if (user?.emailVerifiedAt) redirect(next)
  if (user) redirect(`/verify?next=${encodeURIComponent(next)}`)
  const message = error ? (ERRORS[error] ?? ERRORS['1']) : null

  return (
    <div className="flex min-h-dvh items-center justify-center bg-slate-900 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center text-slate-100">
          <p aria-hidden className="text-4xl">
            🫧
          </p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">Suds</h1>
          <p className="mt-1 text-xs uppercase tracking-widest text-slate-400">
            wash · work · post
          </p>
        </div>
        <form
          method="post"
          action="/api/login"
          className="space-y-4 rounded-xl border border-white/10 bg-white p-6 shadow-xl"
        >
          <input type="hidden" name="next" value={rawNext ? next : ''} />
          {verified || reset ? (
            <p role="status" className="text-sm text-emerald-700">
              {reset
                ? 'Password changed. Sign in with your new password.'
                : 'Email verified. Sign in to continue.'}
            </p>
          ) : null}
          {message ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {message}
            </p>
          ) : null}
          <Field label="Email">
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className={inputClass}
              placeholder="you@shop.com"
            />
          </Field>
          <Field label="Password">
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className={inputClass}
            />
          </Field>
          <button type="submit" className={`${btnPrimary} w-full`}>
            Sign in
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-slate-300">
          <Link href="/recover" className="underline">
            Forgot password?
          </Link>{' '}
          ·{' '}
          <Link
            href={
              rawNext
                ? `/signup?${rawNext.startsWith('/b/') ? 'kind=CUSTOMER&' : ''}next=${encodeURIComponent(next)}`
                : '/signup'
            }
            className="underline"
          >
            Create account
          </Link>
        </p>
      </div>
    </div>
  )
}
