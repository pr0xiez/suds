import { MagnifyingGlassIcon, PlusIcon, UsersThreeIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import {
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  inputClass,
  linkClass,
  PageHeader,
  tdClass,
  thClass,
} from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import type { Prisma } from '@/lib/generated/prisma/client'

export const metadata = { title: 'Customers' }

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const user = await requireUser()
  const { q: rawQ } = await searchParams
  const q = (rawQ ?? '').trim()

  const where: Prisma.CustomerWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { email: { contains: q, mode: 'insensitive' } },
          { vehicles: { some: { model: { contains: q, mode: 'insensitive' } } } },
          { vehicles: { some: { make: { contains: q, mode: 'insensitive' } } } },
        ],
      }
    : {}

  const customers = await prisma.customer.findMany({
    where: { ...where, businessId: user.businessId },
    include: { vehicles: true, _count: { select: { jobs: true } } },
    orderBy: { name: 'asc' },
    take: 200,
  })

  return (
    <div>
      <PageHeader
        title="Customers"
        subtitle={
          q
            ? `${customers.length} match${customers.length === 1 ? '' : 'es'} for "${q}"`
            : undefined
        }
        actions={
          <Link href="/customers/new" className={btnPrimary}>
            <PlusIcon aria-hidden />
            New customer
          </Link>
        }
      />

      <form
        method="get"
        action="/customers"
        role="search"
        className="mb-6 flex max-w-lg items-center gap-2"
      >
        <div className="relative min-w-0 flex-1">
          <MagnifyingGlassIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
          />
          <input
            name="q"
            defaultValue={q}
            aria-label="Search customers"
            placeholder="Search name, phone, email, vehicle…"
            className={`${inputClass} pl-9`}
          />
        </div>
        <button type="submit" className={btnSecondary}>
          Search
        </button>
        {q ? (
          <Link href="/customers" className={`${linkClass} shrink-0 px-1 text-sm`}>
            Clear
          </Link>
        ) : null}
      </form>

      <Card padded={false}>
        {customers.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon={UsersThreeIcon}
              title={q ? 'No customers match' : 'No customers yet'}
              hint="Every job starts with a customer and their vehicle."
              action={
                q ? (
                  <Link href="/customers" className={btnSecondary}>
                    Clear search
                  </Link>
                ) : (
                  <Link href="/customers/new" className={btnPrimary}>
                    <PlusIcon aria-hidden />
                    New customer
                  </Link>
                )
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className={thClass}>
                    Name
                  </th>
                  <th scope="col" className={`${thClass} hidden sm:table-cell`}>
                    Phone
                  </th>
                  <th scope="col" className={`${thClass} hidden lg:table-cell`}>
                    Email
                  </th>
                  <th scope="col" className={`${thClass} hidden md:table-cell`}>
                    Vehicles
                  </th>
                  <th scope="col" className={`${thClass} text-right`}>
                    Jobs
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customers.map((customer) => {
                  const vehicles = customer.vehicles
                    .map((v) => [v.year, v.make, v.model].filter(Boolean).join(' '))
                    .join(', ')
                  return (
                    <tr key={customer.id} className="relative transition-colors hover:bg-surface-2">
                      <td className={`${tdClass} max-w-0 sm:max-w-none`}>
                        <Link
                          href={`/customers/${customer.id}`}
                          className="block truncate font-medium text-ink after:absolute after:inset-0"
                        >
                          {customer.name}
                        </Link>
                        <span className="mt-0.5 block truncate text-xs text-ink-muted sm:hidden">
                          {[customer.phone, vehicles].filter(Boolean).join(', ') ||
                            'No phone or vehicle yet'}
                        </span>
                      </td>
                      <td
                        className={`${tdClass} hidden whitespace-nowrap tabular-nums text-ink-muted sm:table-cell`}
                      >
                        {customer.phone || <span className="text-ink-faint">No phone</span>}
                      </td>
                      <td className={`${tdClass} hidden text-ink-muted lg:table-cell`}>
                        {customer.email || <span className="text-ink-faint">No email</span>}
                      </td>
                      <td
                        className={`${tdClass} hidden max-w-64 truncate text-ink-muted md:table-cell`}
                      >
                        {customer.vehicles.length === 0 ? (
                          <span className="text-ink-faint">No vehicles</span>
                        ) : (
                          vehicles
                        )}
                      </td>
                      <td className={`${tdClass} w-16 text-right tabular-nums text-ink`}>
                        {customer._count.jobs}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
