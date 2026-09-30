import Link from 'next/link'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/lib/demo'

export function DemoSignIn({
  accountRole,
  next,
  children,
  className,
}: {
  accountRole: keyof typeof DEMO_ACCOUNTS
  next?: string
  children: React.ReactNode
  className?: string
}) {
  const account = DEMO_ACCOUNTS[accountRole]
  return (
    <form method="post" action="/api/login">
      <input type="hidden" name="email" value={account.email} />
      <input type="hidden" name="password" value={DEMO_PASSWORD} />
      <input type="hidden" name="next" value={next ?? account.next} />
      <button type="submit" className={className}>
        {children}
      </button>
    </form>
  )
}

export function DemoToolbar() {
  return (
    <aside
      aria-label="Demo controls"
      className="no-print fixed bottom-3 right-3 z-50 flex max-w-[calc(100%-24px)] flex-wrap items-center gap-2 rounded-2xl border border-emerald-700 bg-emerald-950 px-4 py-3 text-xs text-white shadow-xl"
    >
      <Link href="/demo" className="font-bold text-lime-200">
        Demo tour
      </Link>
      <span aria-hidden className="text-emerald-500">
        ·
      </span>
      <DemoSignIn accountRole="owner" className="hover:underline">
        Owner
      </DemoSignIn>
      <DemoSignIn accountRole="customer" className="hover:underline">
        Customer
      </DemoSignIn>
      <Link href="/demo/inbox" className="hover:underline">
        Demo inbox
      </Link>
    </aside>
  )
}
