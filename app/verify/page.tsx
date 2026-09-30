import Link from 'next/link'
import { AccountFrame } from '@/components/AccountFrame'
import { btnPrimary, Field, inputClass } from '@/components/ui'
import { tokenHash } from '@/lib/auth/accounts'
import { safeAuthNext } from '@/lib/business'
import { prisma } from '@/lib/db/client'

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; next?: string; error?: string; sent?: string }>
}) {
  const query = await searchParams
  const next = safeAuthNext(query.next)
  const token =
    query.token && /^[A-Za-z0-9_-]{43}$/.test(query.token)
      ? await prisma.accountToken.findUnique({
          where: { tokenHash: tokenHash(query.token) },
          select: {
            purpose: true,
            consumedAt: true,
            expiresAt: true,
            user: { select: { emailVerifiedAt: true } },
          },
        })
      : null
  const valid =
    token && !token.consumedAt && token.expiresAt > new Date() && token.purpose !== 'RESET_PASSWORD'
  const needPassword =
    valid &&
    ['MEMBERSHIP_INVITE', 'CUSTOMER_LINK'].includes(token.purpose) &&
    !token.user.emailVerifiedAt
  return (
    <AccountFrame title={valid ? 'Confirm your email' : 'Check your email'}>
      {query.error || (query.token && !valid) ? (
        <p role="alert" className="text-sm text-rose-700">
          This link is invalid, expired, or already used. Request another email or recover your
          account.
        </p>
      ) : null}
      {valid ? (
        <form method="post" action="/api/auth/verify" className="space-y-4">
          <input type="hidden" name="token" value={query.token} />
          <input type="hidden" name="next" value={next} />
          <p className="text-sm text-slate-600">
            Confirm to verify your email and accept any invitation included with this link.
          </p>
          {needPassword ? (
            <Field label="Choose a password">
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
          ) : null}
          <button className={btnPrimary} type="submit">
            Confirm email
          </button>
        </form>
      ) : (
        <>
          <p className="text-sm text-slate-600">
            Open the verification link sent to your email. Your account becomes available after you
            confirm it.
          </p>
          <form action="/api/auth/resend" method="post">
            <input type="hidden" name="next" value={next} />
            <button type="submit" className={btnPrimary}>
              Send another verification email
            </button>
          </form>
        </>
      )}
      {query.sent ? (
        <p role="status" className="text-sm text-slate-600">
          If your account needs verification, another email has been queued.
        </p>
      ) : null}
      <p className="text-sm">
        <Link
          className="text-emerald-700 underline"
          href={`/login?next=${encodeURIComponent(next)}`}
        >
          Sign in
        </Link>{' '}
        ·{' '}
        <Link className="text-emerald-700 underline" href="/recover">
          Recover account
        </Link>
      </p>
    </AccountFrame>
  )
}
