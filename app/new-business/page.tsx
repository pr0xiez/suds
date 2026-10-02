import { StorefrontIcon } from '@phosphor-icons/react/ssr'
import { AccountFrame } from '@/components/AccountFrame'
import { ErrorBanner } from '@/components/banners'
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
        <ErrorBanner
          message={
            error
              ? 'We could not create your business. Check the name and invitation code, then try again.'
              : null
          }
        />
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
        <button className={`${btnPrimary} w-full`} type="submit">
          <StorefrontIcon aria-hidden />
          Create business
        </button>
      </form>
    </AccountFrame>
  )
}
