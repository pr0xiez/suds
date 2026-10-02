import { FlaskIcon } from '@phosphor-icons/react/ssr'
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

const item =
  'inline-flex min-h-8 items-center whitespace-nowrap rounded-full px-2.5 font-medium text-chrome-muted transition-colors hover:bg-chrome-2 hover:text-chrome-ink'

/**
 * Development-only demo switcher. On phones it sits above the app shell's fixed
 * tab bar (56px plus the safe area) so it never covers a tab.
 */
export function DemoToolbar() {
  return (
    <aside
      aria-label="Demo controls"
      className="no-print fixed right-3 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-50 flex max-w-[calc(100%-1.5rem)] items-center gap-0.5 overflow-x-auto rounded-full border border-chrome-line bg-chrome/95 p-1 text-xs text-chrome-ink shadow-float backdrop-blur-md md:bottom-3"
    >
      <Link
        href="/demo"
        className="inline-flex min-h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-2.5 font-semibold text-on-accent transition-colors hover:bg-accent-strong"
      >
        <FlaskIcon aria-hidden className="size-3.5" />
        <span className="sm:hidden">Demo</span>
        <span className="hidden sm:inline">Demo tour</span>
      </Link>
      <DemoSignIn accountRole="owner" className={item}>
        Owner
      </DemoSignIn>
      <DemoSignIn accountRole="customer" className={item}>
        Customer
      </DemoSignIn>
      <Link href="/demo/inbox" className={item}>
        <span className="sm:hidden">Inbox</span>
        <span className="hidden sm:inline">Demo inbox</span>
      </Link>
    </aside>
  )
}
