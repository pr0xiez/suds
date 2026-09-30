import Link from 'next/link'
import { AccountFrame } from '@/components/AccountFrame'
import { btnPrimary, Field, inputClass } from '@/components/ui'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>
}) {
  const query = await searchParams
  const token = query.token && /^[A-Za-z0-9_-]{43}$/.test(query.token) ? query.token : ''
  return (
    <AccountFrame title="Choose a new password">
      {query.error ? (
        <p role="alert" className="text-sm text-rose-700">
          This link is invalid or expired, or the password is too short. Request a new recovery
          link.
        </p>
      ) : null}
      {token ? (
        <form method="post" action="/api/auth/reset-password" className="space-y-4">
          <input type="hidden" name="token" value={token} />
          <Field label="New password">
            <input
              className={inputClass}
              type="password"
              name="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              required
            />
          </Field>
          <button type="submit" className={btnPrimary}>
            Reset password
          </button>
          <p className="text-xs text-slate-500">This signs out your other sessions.</p>
        </form>
      ) : null}
      <Link className="text-sm text-emerald-700 underline" href="/recover">
        Request a recovery link
      </Link>
    </AccountFrame>
  )
}
