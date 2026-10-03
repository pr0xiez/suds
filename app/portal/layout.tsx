import { LifebuoyIcon, SignOutIcon, StorefrontIcon } from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { btnGhost, btnSmall } from '@/components/ui'
import { requirePortalUser } from '@/lib/bookingCustomer'
import { SUPPORT_MAILTO } from '@/lib/support'

/**
 * A layout cannot read the pathname, so each portal page marks its section with
 * `data-portal-section` and the matching tab underlines itself through :has().
 */
const tab =
  '-mb-px inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 border-transparent text-sm font-medium text-ink-muted transition-colors hover:text-ink [&_svg]:size-4'
const appointmentsActive =
  'group-has-[[data-portal-section=appointments]]/portal:border-ink group-has-[[data-portal-section=appointments]]/portal:text-ink'
const vehiclesActive =
  'group-has-[[data-portal-section=vehicles]]/portal:border-ink group-has-[[data-portal-section=vehicles]]/portal:text-ink'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortalUser()
  return (
    <div className="group/portal min-h-dvh bg-canvas text-ink">
      <header className="no-print border-b border-line bg-surface">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href="/portal" className="inline-flex shrink-0 items-center gap-2.5">
            <Logo />
            <span className="rounded-full border border-line bg-surface-2 px-2 py-0.5 text-xs font-medium text-ink-muted">
              Customer
            </span>
          </Link>
          <div className="flex min-w-0 items-center gap-1 sm:gap-3">
            <span className="min-w-0 truncate text-sm text-ink-muted">{user.name}</span>
            <form method="post" action="/api/logout" className="shrink-0">
              <button type="submit" className={clsx(btnGhost, btnSmall)}>
                <SignOutIcon aria-hidden />
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav
          aria-label="Customer navigation"
          className="mx-auto flex max-w-5xl gap-6 overflow-x-auto px-4 sm:px-6"
        >
          <Link href="/portal" className={clsx(tab, appointmentsActive)}>
            Appointments
          </Link>
          <Link href="/portal/vehicles" className={clsx(tab, vehiclesActive)}>
            My vehicles
          </Link>
          <Link href="/new-business" className={clsx(tab, 'sm:ml-auto')}>
            <StorefrontIcon aria-hidden />
            Start a detailing business
          </Link>
          <a href={SUPPORT_MAILTO} className={tab}>
            <LifebuoyIcon aria-hidden />
            Support
          </a>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 pt-8 pb-16 sm:px-6 sm:pt-10">{children}</main>
    </div>
  )
}
