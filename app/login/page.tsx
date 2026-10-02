import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AccountFrame } from '@/components/AccountFrame'
import { ErrorBanner } from '@/components/banners'
import { btnPrimary, Field, inputClass, linkClass } from '@/components/ui'
import { getSessionUser } from '@/lib/auth/session'
import { businessUserFor, safeAuthNext } from '@/lib/business'

const ERRORS: Record<string, string> = {
  '1': 'Wrong email or password.',
  rate: 'Too many attempts. Wait a few minutes and try again.',
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
    <AccountFrame
      title="Sign in"
      subtitle="Bookings, jobs, and marketing for your detail business."
    >
      <form method="post" action="/api/login" className="space-y-5">
        <input type="hidden" name="next" value={rawNext ? next : ''} />
        {verified || reset ? (
          <p
            role="status"
            className="rounded-control border border-ok-line bg-ok-soft px-3 py-2.5 text-sm text-ok"
          >
            {reset
              ? 'Password changed. Sign in with your new password.'
              : 'Email verified. Sign in to continue.'}
          </p>
        ) : null}
        <ErrorBanner message={message} />
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
        <div>
          <div className="mb-1.5 flex items-baseline justify-between gap-3">
            <label htmlFor="login-password" className="text-sm font-medium text-ink">
              Password
            </label>
            <Link href="/recover" className={`${linkClass} text-xs`}>
              Forgot password?
            </Link>
          </div>
          <input
            id="login-password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className={inputClass}
          />
        </div>
        <button type="submit" className={`${btnPrimary} w-full`}>
          Sign in
        </button>
      </form>
      <p className="border-t border-line pt-5 text-sm text-ink-muted">
        New to Suds?{' '}
        <Link
          href={
            rawNext
              ? `/signup?${rawNext.startsWith('/b/') ? 'kind=CUSTOMER&' : ''}next=${encodeURIComponent(next)}`
              : '/signup'
          }
          className={linkClass}
        >
          Create account
        </Link>
      </p>
    </AccountFrame>
  )
}
