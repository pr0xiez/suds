import {
  CalendarBlankIcon,
  CalendarDotsIcon,
  ClipboardTextIcon,
  DotsThreeOutlineIcon,
  GearSixIcon,
  ImagesIcon,
  LifebuoyIcon,
  MegaphoneIcon,
  PlusIcon,
  SignOutIcon,
  SquaresFourIcon,
  StorefrontIcon,
  TrayIcon,
  UserCircleIcon,
  UsersThreeIcon,
} from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { Logo } from '@/components/Logo'
import { MoreSheet, NavLink } from '@/components/NavLink'
import { SUPPORT_MAILTO } from '@/lib/support'

type NavItem = {
  href: string
  label: string
  icon: React.ReactNode
  ownerOnly?: boolean
  also?: string[]
}

const GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: 'Operate',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: <SquaresFourIcon /> },
      { href: '/schedule', label: 'Schedule', icon: <CalendarBlankIcon /> },
      { href: '/jobs', label: 'Jobs', icon: <ClipboardTextIcon /> },
      { href: '/customers', label: 'Customers', icon: <UsersThreeIcon /> },
      { href: '/bookings', label: 'Booking requests', icon: <TrayIcon />, ownerOnly: true },
    ],
  },
  {
    label: 'Grow',
    items: [
      { href: '/marketing', label: 'Marketing', icon: <MegaphoneIcon />, ownerOnly: true },
      { href: '/social', label: 'Content calendar', icon: <CalendarDotsIcon /> },
      { href: '/library', label: 'Library', icon: <ImagesIcon /> },
    ],
  },
  {
    label: 'Set up',
    items: [
      { href: '/onboarding', label: 'Business setup', icon: <StorefrontIcon />, ownerOnly: true },
      { href: '/settings', label: 'Settings', icon: <GearSixIcon />, also: ['/availability'] },
    ],
  },
]

/** The four destinations a detailer reaches for between jobs; the rest live under More. */
const TABS = ['/dashboard', '/schedule', '/jobs', '/customers']

export function AppShell({
  user,
  businessId,
  businesses,
  children,
}: {
  user: { name: string; email: string; role: string }
  businessId: string
  businesses: Array<{ id: string; name: string }>
  children: React.ReactNode
}) {
  const isOwner = user.role === 'OWNER'
  const groups = GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => isOwner || !item.ownerOnly),
  })).filter((group) => group.items.length > 0)
  const allItems = groups.flatMap((group) => group.items)
  const tabItems = TABS.map((href) => allItems.find((item) => item.href === href)).filter(
    (item): item is NavItem => item !== undefined,
  )
  const moreItems = allItems.filter((item) => !TABS.includes(item.href))
  const current = businesses.find((business) => business.id === businessId)

  const switcher = (
    <BusinessSwitcher businessId={businessId} businesses={businesses} idSuffix="sidebar" />
  )

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15.5rem_minmax(0,1fr)] print:block">
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh flex-col bg-chrome text-chrome-ink md:flex">
        <div className="px-5 pt-5 pb-4">
          <Link href="/dashboard" aria-label="Suds dashboard" className="inline-flex">
            <Logo tone="chrome" />
          </Link>
        </div>
        <div className="px-3 pb-4">{switcher}</div>
        <nav aria-label="Main" className="flex-1 space-y-5 overflow-y-auto px-3 pb-4">
          {groups.map((group) => (
            <div key={group.label}>
              <p className="px-3 pb-1.5 text-xs font-medium text-chrome-muted/80">{group.label}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink key={item.href} href={item.href} also={item.also}>
                    {item.icon}
                    <span className="truncate">{item.label}</span>
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <AccountBlock user={user} />
      </aside>

      {/* Phone top bar */}
      <header className="no-print flex h-14 items-center justify-between gap-3 bg-chrome px-4 text-chrome-ink md:hidden">
        <Link href="/dashboard" aria-label="Suds dashboard" className="inline-flex">
          <Logo tone="chrome" />
        </Link>
        {current ? (
          <span className="min-w-0 truncate text-sm text-chrome-muted">{current.name}</span>
        ) : null}
      </header>

      <main className="min-w-0 px-4 pt-6 pb-28 sm:px-6 md:px-10 md:pt-10 md:pb-16 print:p-0">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>

      {/* Phone tab bar */}
      <nav
        aria-label="Main"
        className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-chrome-line bg-chrome/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        {tabItems.map((item) => (
          <NavLink key={item.href} href={item.href} variant="tab">
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
        <MoreSheet
          activePaths={moreItems.flatMap((item) => [item.href, ...(item.also ?? [])])}
          trigger={
            <>
              <DotsThreeOutlineIcon />
              <span>More</span>
            </>
          }
        >
          <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-chrome-line" aria-hidden />
          <div className="px-4 pt-3 pb-2">
            <BusinessSwitcher businessId={businessId} businesses={businesses} idSuffix="sheet" />
          </div>
          <div className="grid grid-cols-1 gap-0.5 px-2 pb-2">
            {moreItems.map((item) => (
              <NavLink key={item.href} href={item.href} also={item.also}>
                {item.icon}
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
          <AccountBlock user={user} />
        </MoreSheet>
      </nav>
    </div>
  )
}

function BusinessSwitcher({
  businessId,
  businesses,
  idSuffix,
}: {
  businessId: string
  businesses: Array<{ id: string; name: string }>
  idSuffix: string
}) {
  const selectId = `business-switch-${idSuffix}`
  return (
    <form method="post" action="/api/business/switch">
      <label htmlFor={selectId} className="sr-only">
        Business workspace
      </label>
      <div className="flex gap-1.5">
        <select
          id={selectId}
          name="businessId"
          defaultValue={businessId}
          className="min-h-9 w-full min-w-0 truncate rounded-control border border-chrome-line bg-chrome-2 px-2.5 text-sm text-chrome-ink focus:border-accent focus:outline-none"
        >
          {businesses.map((business) => (
            <option key={business.id} value={business.id}>
              {business.name}
            </option>
          ))}
        </select>
        {businesses.length > 1 ? (
          <button
            type="submit"
            className="min-h-9 shrink-0 rounded-control border border-chrome-line px-2.5 text-xs font-medium text-chrome-ink hover:bg-chrome-2"
          >
            Switch
          </button>
        ) : null}
      </div>
      <Link
        href="/new-business"
        className="mt-2 inline-flex items-center gap-1.5 px-1 text-xs text-chrome-muted transition-colors hover:text-chrome-ink"
      >
        <PlusIcon aria-hidden className="size-3.5" />
        Start another business
      </Link>
    </form>
  )
}

function AccountBlock({ user }: { user: { name: string; email: string } }) {
  const initial = user.name.trim().charAt(0).toUpperCase() || '?'
  return (
    <div className="border-t border-chrome-line px-4 py-4">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-sm font-semibold text-on-accent"
        >
          {initial}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-chrome-ink">{user.name}</p>
          <p className="truncate text-xs text-chrome-muted">{user.email}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1">
        <Link
          href="/portal"
          className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-control px-2 text-xs text-chrome-muted transition-colors hover:bg-chrome-2 hover:text-chrome-ink"
        >
          <UserCircleIcon aria-hidden className="size-4" />
          Customer portal
        </Link>
        <a
          href={SUPPORT_MAILTO}
          className="inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-control px-2 text-xs text-chrome-muted transition-colors hover:bg-chrome-2 hover:text-chrome-ink"
        >
          <LifebuoyIcon aria-hidden className="size-4" />
          Support
        </a>
        <form method="post" action="/api/logout">
          <button
            type="submit"
            className="inline-flex min-h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-control px-2 text-xs text-chrome-muted transition-colors hover:bg-chrome-2 hover:text-chrome-ink"
          >
            <SignOutIcon aria-hidden className="size-4" />
            Sign out
          </button>
        </form>
      </div>
    </div>
  )
}
