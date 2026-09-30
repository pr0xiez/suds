import Link from 'next/link'
import { btnPrimary, btnSecondary, Card, EmptyState, inputClass, PageHeader } from '@/components/ui'
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
        actions={
          <Link href="/customers/new" className={btnPrimary}>
            + New customer
          </Link>
        }
      />

      <form method="get" action="/customers" className="mb-4 flex max-w-md items-center gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search name, phone, email, vehicle…"
          className={inputClass}
        />
        <button type="submit" className={btnSecondary}>
          Search
        </button>
      </form>

      <Card padded={false}>
        {customers.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title={q ? 'No customers match' : 'No customers yet'}
              hint="Every job starts with a customer and their vehicle."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Phone</th>
                  <th className="px-4 py-2.5">Email</th>
                  <th className="px-4 py-2.5">Vehicles</th>
                  <th className="px-4 py-2.5 text-right">Jobs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {customers.map((customer) => (
                  <tr key={customer.id} className="relative hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-900">
                      <Link
                        href={`/customers/${customer.id}`}
                        className="after:absolute after:inset-0"
                      >
                        {customer.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-600">{customer.phone || '—'}</td>
                    <td className="px-4 py-2.5 text-slate-600">{customer.email || '—'}</td>
                    <td className="max-w-56 truncate px-4 py-2.5 text-slate-600">
                      {customer.vehicles.length === 0
                        ? '—'
                        : customer.vehicles
                            .map((v) => [v.year, v.make, v.model].filter(Boolean).join(' '))
                            .join(', ')}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{customer._count.jobs}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
