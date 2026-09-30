import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AccountFrame } from '@/components/AccountFrame'
import { btnPrimary, Field, inputClass } from '@/components/ui'
import { getSessionUser } from '@/lib/auth/session'
import { safeAuthNext } from '@/lib/business'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; next?: string; error?: string }>
}) {
  const query = await searchParams
  const customer = query.kind === 'CUSTOMER'
  const user = await getSessionUser()
  if (user?.emailVerifiedAt && !customer) redirect('/new-business')
  if (user?.emailVerifiedAt && customer) redirect(safeAuthNext(query.next, '/portal'))
  const next = safeAuthNext(query.next, customer ? '/portal' : '/dashboard')
  return (
    <AccountFrame
      title={customer ? 'Create your customer account' : 'Start your detailing business'}
    >
      {query.error ? (
        <p role="alert" className="text-sm text-rose-700">
          We could not create your account. Check your details, use a password with 12–128
          characters, or sign in if you already have an account.
        </p>
      ) : null}
      <form action="/api/auth/signup" method="post" className="space-y-4">
        <input type="hidden" name="kind" value={customer ? 'CUSTOMER' : 'OWNER'} />
        <input type="hidden" name="next" value={next} />
        <Field label="Your name">
          <input name="name" required maxLength={120} autoComplete="name" className={inputClass} />
        </Field>
        {!customer ? (
          <Field label="Business name">
            <input
              name="businessName"
              required
              maxLength={120}
              autoComplete="organization"
              className={inputClass}
            />
          </Field>
        ) : null}
        <Field label="Email">
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            className={inputClass}
          />
        </Field>
        <Field label="Password">
          <input
            name="password"
            type="password"
            minLength={12}
            maxLength={128}
            required
            autoComplete="new-password"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-slate-500">Use at least 12 characters.</p>
        </Field>
        {!customer && process.env.SIGNUP_CODE ? (
          <Field label="Pilot invitation code">
            <input name="signupCode" required autoComplete="off" className={inputClass} />
          </Field>
        ) : null}
        <button type="submit" className={`${btnPrimary} w-full`}>
          Create account
        </button>
      </form>
      <p className="text-sm text-slate-600">
        Already have an account?{' '}
        <Link
          className="text-emerald-700 underline"
          href={`/login?next=${encodeURIComponent(next)}`}
        >
          Sign in
        </Link>
      </p>
      <p className="text-sm text-slate-600">
        <Link
          className="text-emerald-700 underline"
          href={customer ? '/signup' : '/signup?kind=CUSTOMER'}
        >
          {customer
            ? 'Starting a detailing business? Create an owner account'
            : 'Booking a detail? Create a customer account'}
        </Link>
      </p>
      <p className="text-xs text-slate-500">
        We will email you a verification link before you can use your account.
      </p>
    </AccountFrame>
  )
}
