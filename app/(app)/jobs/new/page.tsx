import { PlusIcon, UsersThreeIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { JobForm } from '@/components/JobForm'
import { btnPrimary, Card, EmptyState, linkClass, PageHeader } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { describeVehicle } from '@/lib/captions'
import { toDatetimeLocalValue } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { activeServices } from '@/lib/ops/services'
import { getSettings } from '@/lib/ops/settings'

export const metadata = { title: 'New job' }

export default async function NewJobPage({
  searchParams,
}: {
  searchParams: Promise<{ at?: string; customer?: string }>
}) {
  const user = await requireUser()
  const { at, customer } = await searchParams
  const [settings, customers, services] = await Promise.all([
    getSettings(user.businessId),
    prisma.customer.findMany({
      where: { businessId: user.businessId },
      include: { vehicles: { orderBy: { createdAt: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
    activeServices(user.businessId),
  ])

  if (customers.length === 0) {
    return (
      <div>
        <PageHeader title="New job" back={{ href: '/jobs', label: 'Jobs' }} />
        <Card>
          <EmptyState
            icon={UsersThreeIcon}
            title="No customers yet"
            hint="Add your first customer to book a job."
            action={
              <Link href="/customers/new" className={btnPrimary}>
                <PlusIcon aria-hidden />
                Add a customer
              </Link>
            }
          />
        </Card>
      </div>
    )
  }

  const scheduledAt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(at ?? '')
    ? (at as string)
    : toDatetimeLocalValue(new Date(Math.ceil(Date.now() / 3600000) * 3600000), settings.timezone)

  const initialCustomer = customers.find((c) => c.id === customer) ?? null

  return (
    <div>
      <PageHeader
        title="New job"
        back={{ href: '/jobs', label: 'Jobs' }}
        subtitle={
          <>
            Need someone new?{' '}
            <Link href="/customers/new" className={linkClass}>
              Add a customer
            </Link>
          </>
        }
      />
      <JobForm
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          vehicles: c.vehicles.map((v) => ({ id: v.id, label: describeVehicle(v) })),
        }))}
        services={services.map((s) => ({
          id: s.id,
          name: s.name,
          priceCents: s.priceCents,
          durationMin: s.durationMin,
          category: s.category,
        }))}
        initial={{
          jobId: '',
          customerId: initialCustomer?.id ?? '',
          vehicleId: initialCustomer?.vehicles[0]?.id ?? '',
          scheduledAt,
          durationMin: '',
          serviceIds: [],
          bookedLines: [],
          customLines: [],
          discount: '',
          notes: '',
          internalNotes: '',
        }}
      />
    </div>
  )
}
