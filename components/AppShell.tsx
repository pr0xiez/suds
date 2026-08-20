import { NavLink } from '@/components/NavLink'

const NAV = [
  { href: '/dashboard', label: 'Dashboard', icon: '◧' },
  { href: '/schedule', label: 'Schedule', icon: '▦' },
  { href: '/jobs', label: 'Jobs', icon: '☰' },
  { href: '/customers', label: 'Customers', icon: '☺' },
  { href: '/social', label: 'Social', icon: '✦' },
  { href: '/library', label: 'Library', icon: '▣' },
  { href: '/settings', label: 'Settings', icon: '⚙' },
]

export function AppShell({
  user,
  children,
}: {
  user: { name: string; email: string; role: string }
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-dvh flex-col md:flex-row">
      <aside className="no-print flex shrink-0 flex-col bg-slate-900 text-slate-100 md:min-h-dvh md:w-56 md:sticky md:top-0 md:h-dvh">
        <div className="flex items-center gap-2 px-4 py-4">
          <span aria-hidden className="text-xl">
            🫧
          </span>
          <div>
            <p className="text-lg font-bold leading-tight tracking-tight">Suds</p>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">
              wash · work · post
            </p>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-2 pb-3 md:flex-1 md:flex-col md:overflow-x-visible">
          {NAV.map((item) => (
            <NavLink key={item.href} href={item.href}>
              <span aria-hidden className="w-4 text-center text-xs opacity-70">
                {item.icon}
              </span>
              <span className="whitespace-nowrap">{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="hidden border-t border-white/10 px-4 py-3 md:block">
          <p className="truncate text-sm font-medium text-slate-200">{user.name}</p>
          <p className="truncate text-xs text-slate-400">{user.email}</p>
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
