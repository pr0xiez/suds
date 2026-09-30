import { NavLink } from '@/components/NavLink'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '◧' },
  { href: '/schedule', label: 'Schedule', icon: '▦' },
  { href: '/jobs', label: 'Jobs', icon: '☰' },
  { href: '/customers', label: 'Customers', icon: '☺' },
  { href: '/marketing', label: 'Marketing', icon: '✦' },
  { href: '/social', label: 'Content calendar', icon: '▦' },
  { href: '/bookings', label: 'Booking requests', icon: '◷' },
  { href: '/onboarding', label: 'Business setup', icon: '⚙' },
  { href: '/library', label: 'Library', icon: '▣' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

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
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="no-print flex shrink-0 flex-col bg-slate-900 text-slate-100 md:min-h-dvh md:w-56 md:sticky md:top-0 md:h-dvh">
        <div className="flex items-center gap-2 px-4 py-4">
          <svg
            aria-hidden="true"
            viewBox="0 0 28 28"
            className="h-7 w-7 text-cyan-300"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="10" cy="17" r="7" />
            <circle cx="21" cy="7" r="4" />
            <circle cx="22" cy="22" r="2.5" />
          </svg>
          <div>
            <p className="text-lg font-bold leading-tight tracking-tight">Suds</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">
              wash · work · post
            </p>
          </div>
        </div>
        <form method="post" action="/api/business/switch" className="px-3 pb-3">
          <label htmlFor="business-switch" className="sr-only">
            Business workspace
          </label>
          <select
            id="business-switch"
            name="businessId"
            defaultValue={businessId}
            className="w-full rounded-lg bg-slate-800 px-2 py-2 text-sm"
          >
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </select>
          {businesses.length > 1 ? (
            <button type="submit" className="mt-1 text-xs text-slate-300 underline">
              Switch business
            </button>
          ) : null}
          <a href="/new-business" className="mt-2 block text-xs text-slate-400 hover:text-white">
            Start another business
          </a>
        </form>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-1 md:flex-col md:overflow-x-visible">
          {NAV.filter(
            (item) =>
              user.role === 'OWNER' ||
              !['/marketing', '/bookings', '/onboarding'].includes(item.href),
          ).map((item) => (
            <NavLink key={item.href} href={item.href}>
              <span aria-hidden className="w-4 text-center text-xs opacity-70">
                {item.icon}
              </span>
              <span className="whitespace-nowrap">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-white/10 px-4 py-3">
          <p className="truncate text-sm font-medium text-slate-200">{user.name}</p>
          <p className="truncate text-xs text-slate-400">{user.email}</p>
          <a href="/portal" className="text-xs text-slate-400 hover:text-white">
            Customer portal
          </a>
          <form method="post" action="/api/logout" className="mt-2">
            <button
              type="submit"
              className="text-xs font-medium text-slate-400 underline-offset-2 hover:text-white hover:underline"
            >
              Sign out
            </button>
          </form>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 md:px-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
