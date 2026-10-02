import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AccountFrame } from '@/components/AccountFrame'
import { ErrorBanner } from '@/components/banners'
import { NewPasswordFields } from '@/components/NewPasswordFields'
import { btnPrimary, Field, inputClass, linkClass } from '@/components/ui'
import { authBannerMessage, readAuthErrors } from '@/lib/auth/formErrors'
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
  const errors = readAuthErrors(query.error)
  const invalid = (message?: string) => (message ? true : undefined)
  return (
    <AccountFrame
      title={customer ? 'Create your customer account' : 'Start your detailing business'}
      subtitle="We will email you a verification link before you can use your account."
    >
      <form action="/api/auth/signup" method="post" className="space-y-5">
        <input type="hidden" name="kind" value={customer ? 'CUSTOMER' : 'OWNER'} />
        <input type="hidden" name="next" value={next} />
        <ErrorBanner message={authBannerMessage(errors)} />
        <Field label="Your name" error={errors.fields.name}>
          <input
            name="name"
            required
            maxLength={120}
            autoComplete="name"
            aria-invalid={invalid(errors.fields.name)}
            className={inputClass}
          />
        </Field>
        {!customer ? (
          <Field label="Business name" error={errors.fields.businessName}>
            <input
              name="businessName"
              required
              maxLength={120}
              autoComplete="organization"
              aria-invalid={invalid(errors.fields.businessName)}
              className={inputClass}
            />
          </Field>
        ) : null}
        <Field label="Email" error={errors.fields.email}>
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
            aria-invalid={invalid(errors.fields.email)}
            className={inputClass}
          />
        </Field>
        <NewPasswordFields errors={errors.fields} />
        {!customer && process.env.SIGNUP_CODE ? (
          <Field label="Pilot invitation code" error={errors.fields.signupCode}>
            <input
              name="signupCode"
              required
              autoComplete="off"
              aria-invalid={invalid(errors.fields.signupCode)}
              className={inputClass}
            />
          </Field>
        ) : null}
        <button type="submit" className={`${btnPrimary} w-full`}>
          Create account
        </button>
      </form>
      <div className="space-y-2 border-t border-line pt-5 text-sm text-ink-muted">
        <p>
          Already have an account?{' '}
          <Link className={linkClass} href={`/login?next=${encodeURIComponent(next)}`}>
            Sign in
          </Link>
        </p>
        <p>
          <Link className={linkClass} href={customer ? '/signup' : '/signup?kind=CUSTOMER'}>
            {customer
              ? 'Starting a detailing business? Create an owner account'
              : 'Booking a detail? Create a customer account'}
          </Link>
        </p>
      </div>
    </AccountFrame>
  )
}
