import { StorefrontIcon } from '@phosphor-icons/react/ssr'
import { AccountFrame } from '@/components/AccountFrame'
import { ErrorBanner } from '@/components/banners'
import { btnPrimary, Field, inputClass } from '@/components/ui'
import { authBannerMessage, readAuthErrors } from '@/lib/auth/formErrors'
import { requireVerifiedIdentity } from '@/lib/auth/session'

export default async function NewBusinessPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await requireVerifiedIdentity()
  const errors = readAuthErrors((await searchParams).error)
  return (
    <AccountFrame
      title="Start a detailing business"
      subtitle={
        <>
          Create a business using your existing account,{' '}
          <span className="break-all font-medium text-ink">{user.email}</span>.
        </>
      }
    >
      <form method="post" action="/api/auth/new-business" className="space-y-5">
        <ErrorBanner message={authBannerMessage(errors)} />
        <Field label="Business name" error={errors.fields.businessName}>
          <input
            className={inputClass}
            name="businessName"
            maxLength={120}
            required
            autoComplete="organization"
            aria-invalid={errors.fields.businessName ? true : undefined}
          />
        </Field>
        {process.env.SIGNUP_CODE ? (
          <Field label="Pilot invitation code" error={errors.fields.signupCode}>
            <input
              className={inputClass}
              name="signupCode"
              required
              autoComplete="off"
              aria-invalid={errors.fields.signupCode ? true : undefined}
            />
          </Field>
        ) : null}
        <button className={`${btnPrimary} w-full`} type="submit">
          <StorefrontIcon aria-hidden />
          Create business
        </button>
      </form>
    </AccountFrame>
  )
}
