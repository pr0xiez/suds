import Link from 'next/link'
import { AccountFrame } from '@/components/AccountFrame'
import { ErrorBanner } from '@/components/banners'
import { NewPasswordFields } from '@/components/NewPasswordFields'
import { btnPrimary, linkClass } from '@/components/ui'
import { authBannerMessage, readAuthErrors } from '@/lib/auth/formErrors'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const query = await searchParams
  const token = query.token && /^[A-Za-z0-9_-]{43}$/.test(query.token) ? query.token : ''
  const errors = readAuthErrors(query.error)
  return (
    <AccountFrame title="Choose a new password">
      <ErrorBanner message={authBannerMessage(errors)} />
      {token ? (
        <form method="post" action="/api/auth/reset-password" className="space-y-5">
          <input type="hidden" name="token" value={token} />
          <NewPasswordFields label="New password" errors={errors.fields} />
          <div>
            <button type="submit" className={`${btnPrimary} w-full`}>
              Reset password
            </button>
            <p className="mt-2 text-xs text-ink-muted">This signs out your other sessions.</p>
          </div>
        </form>
      ) : null}
      <p className="border-t border-line pt-5 text-sm">
        <Link className={linkClass} href="/recover">
          Request a recovery link
        </Link>
      </p>
    </AccountFrame>
  )
}
