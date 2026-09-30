import { AccountFrame } from '@/components/AccountFrame'
import { btnPrimary, Field, inputClass } from '@/components/ui'
import { requireVerifiedIdentity } from '@/lib/auth/session'

export default async function NewBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await requireVerifiedIdentity()
  const { error } = await searchParams
  return (
    <AccountFrame title="Start a detailing business">
      <p className="text-sm text-slate-600">
        Create a business using your existing account, {user.email}.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-rose-700">
          We could not create your business. Check the name and invitation code, then try again.
        </p>
      ) : null}
      <form method="post" action="/api/auth/new-business" className="space-y-4">
        <Field label="Business name">
          <input
            className={inputClass}
            name="businessName"
            maxLength={120}
            required
            autoComplete="organization"
          />
        </Field>
        {process.env.SIGNUP_CODE ? (
          <Field label="Pilot invitation code">
            <input className={inputClass} name="signupCode" required autoComplete="off" />
          </Field>
        ) : null}
        <button className={btnPrimary} type="submit">
          Create business
        </button>
      </form>
    </AccountFrame>
  )
}
