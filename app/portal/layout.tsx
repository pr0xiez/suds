import Link from 'next/link'
import { requirePortalUser } from '@/lib/bookingCustomer'

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePortalUser()
  return (
    <div className="min-h-dvh bg-[#f6f8f2] text-emerald-950">
      <header className="border-b border-emerald-900/10 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-5">
          <Link href="/portal" className="text-xl font-bold">
            Suds <span className="text-sm font-normal text-slate-500">Customer</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500">{user.name}</span>
            <form method="post" action="/api/logout">
              <button type="submit" className="text-sm font-semibold">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav
          aria-label="Customer navigation"
          className="mx-auto flex max-w-5xl gap-5 overflow-x-auto px-4 pb-4 text-sm font-semibold"
        >
          <Link href="/portal">Appointments</Link>
          <Link href="/portal/vehicles">My vehicles</Link>
          <Link href="/new-business">Start a detailing business</Link>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  )
}
