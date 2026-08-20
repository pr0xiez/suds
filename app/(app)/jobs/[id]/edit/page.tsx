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
  await requireUser()
  const { id } = await params
  const [settings, job, customers, services] = await Promise.all([
    getSettings(),
    prisma.job.findUnique({
      where: { id },
      include: { items: { orderBy: { sort: 'asc' } } },
    }),
    prisma.customer.findMany({
      include: { vehicles: { orderBy: { createdAt: 'asc' } } },
      orderBy: { name: 'asc' },
    }),
    activeServices(),
  ])
  if (!job) notFound()

  // Catalog lines re-snapshot from today's catalog on save; lines whose service
  // was deleted come back as editable custom lines.
  const serviceIds = job.items
    .map((item) => item.serviceId)
    .filter((sid): sid is string => sid !== null && services.some((s) => s.id === sid))
  const customLines = job.items
    .filter((item) => item.serviceId === null || !services.some((s) => s.id === item.serviceId))
    .map((item) => ({
      name: item.name,
      price: (item.priceCents / 100).toFixed(2),
      durationMin: String(item.durationMin),
    }))

  return (
    <div>
      <PageHeader title="Edit job" subtitle="Prices re-snapshot from the current catalog on save" />
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
          jobId: job.id,
          customerId: job.customerId,
          vehicleId: job.vehicleId,
          scheduledAt: toDatetimeLocalValue(job.scheduledAt, settings.timezone),
          durationMin: String(job.durationMin),
          serviceIds,
          customLines,
          discount: job.discountCents > 0 ? (job.discountCents / 100).toFixed(2) : '',
          notes: job.notes,
          internalNotes: job.internalNotes,
        }}
      />
    </div>
  )
}
