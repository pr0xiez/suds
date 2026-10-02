import { ArrowLeftIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { AccountFrame } from '@/components/AccountFrame'
import { SuccessBanner } from '@/components/banners'
import { btnPrimary, Field, inputClass, linkClass } from '@/components/ui'

export default async function RecoverPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>
}) {
  const { sent } = await searchParams
  return (
    <AccountFrame
      title="Recover your account"
      subtitle={sent ? undefined : 'We will email you a link that expires in one hour.'}
    >
      {sent ? (
        <SuccessBanner message="If that email belongs to an active account, we have queued a password recovery link. Check your inbox." />
      ) : null}
      <form method="post" action="/api/auth/recover" className="space-y-5">
        <Field label="Email">
          <input
            type="email"
            name="email"
            required
            maxLength={254}
            autoComplete="email"
            className={inputClass}
            placeholder="you@example.com"
          />
        </Field>
        <button type="submit" className={`${btnPrimary} w-full`}>
          Send recovery link
        </button>
      </form>
      <p className="border-t border-line pt-5 text-sm">
        <Link className={`${linkClass} inline-flex items-center gap-1.5`} href="/login">
          <ArrowLeftIcon aria-hidden className="size-4" />
          Back to sign in
        </Link>
      </p>
    </AccountFrame>
  )
}
