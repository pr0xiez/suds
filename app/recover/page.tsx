import Link from 'next/link'
import { AccountFrame } from '@/components/AccountFrame'
import { btnPrimary, Field, inputClass } from '@/components/ui'

export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>
}) {
  const { sent } = await searchParams
  return (
    <AccountFrame title="Recover your account">
      {sent ? (
        <p role="status" className="text-sm text-slate-600">
          If that email belongs to an active account, we have queued a password recovery link. Check
          your inbox.
        </p>
      ) : (
        <p className="text-sm text-slate-600">We will email you a link that expires in one hour.</p>
      )}
      <form method="post" action="/api/auth/recover" className="space-y-4">
        <Field label="Email">
          <input
            type="email"
            name="email"
            required
            maxLength={254}
            autoComplete="email"
            className={inputClass}
          />
        </Field>
        <button type="submit" className={btnPrimary}>
          Send recovery link
        </button>
      </form>
      <Link className="text-sm text-emerald-700 underline" href="/login">
        Back to sign in
      </Link>
    </AccountFrame>
  )
}
