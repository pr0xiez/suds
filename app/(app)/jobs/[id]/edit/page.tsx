import { notFound } from 'next/navigation'
import { JobForm } from '@/components/JobForm'
import { PageHeader } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { describeVehicle } from '@/lib/captions'
import { toDatetimeLocalValue } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { activeServices } from '@/lib/ops/services'
import { getSettings } from '@/lib/ops/settings'

export const metadata = { title: 'Edit job' }

export default async function EditJobPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const { id } = await params
  const [settings, job, customers, services] = await Promise.all([
    getSettings(user.businessId),
    prisma.job.findUnique({
      where: { businessId: user.businessId, id },
      include: { items: { orderBy: { sort: 'asc' } } },
    }),
    prisma.customer.findMany({
      where: { businessId: user.businessId },
      include: { vehicles: { orderBy: { createdAt: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
    activeServices(user.businessId),
  ])
  if (!job) notFound()

  // Catalog lines keep their booked name, price, and duration on save; only services added here
  // snapshot the current catalog. A service no longer offered stays selectable at its booked
  // values, and lines whose service was deleted come back as editable custom lines.
  const bookedLines = job.items.flatMap(({ serviceId, name, priceCents, durationMin }) =>
    serviceId === null ? [] : [{ serviceId, name, priceCents, durationMin }],
  )
  const retired = bookedLines.filter(
    (line, index) =>
      !services.some((s) => s.id === line.serviceId) &&
      bookedLines.findIndex((other) => other.serviceId === line.serviceId) === index,
  )
  const customLines = job.items
    .filter((item) => item.serviceId === null)
    .map((item) => ({
      name: item.name,
      price: (item.priceCents / 100).toFixed(2),
      durationMin: String(item.durationMin),
    }))

  return (
    <div>
      <PageHeader
        title="Edit job"
        subtitle="Services already on this job keep their booked price; added ones use today’s catalog"
      />
      <JobForm
        customers={customers.map((c) => ({
          id: c.id,
          name: c.name,
          vehicles: c.vehicles.map((v) => ({ id: v.id, label: describeVehicle(v) })),
        }))}
        services={[
          ...services.map((s) => ({
            id: s.id,
            name: s.name,
            priceCents: s.priceCents,
            durationMin: s.durationMin,
            category: s.category,
          })),
          ...retired.map((line) => ({
            id: line.serviceId,
            name: line.name,
            priceCents: line.priceCents,
            durationMin: line.durationMin,
            category: '',
            retired: true,
          })),
        ]}
        initial={{
          jobId: job.id,
          customerId: job.customerId,
          vehicleId: job.vehicleId,
          scheduledAt: toDatetimeLocalValue(job.scheduledAt, settings.timezone),
          durationMin: String(job.durationMin),
          serviceIds: bookedLines.map((line) => line.serviceId),
          bookedLines,
          customLines,
          discount: job.discountCents > 0 ? (job.discountCents / 100).toFixed(2) : '',
          notes: job.notes,
          internalNotes: job.internalNotes,
        }}
      />
    </div>
  )
}
