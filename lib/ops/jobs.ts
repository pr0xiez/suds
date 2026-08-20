import { prisma } from '@/lib/db/client'
import type { Job, Prisma } from '@/lib/generated/prisma/client'
import type { JobStatus, PaymentMethod } from '@/lib/generated/prisma/enums'
import { deleteUploadFile } from '@/lib/uploads'

export interface CustomLineInput {
  name: string
  priceCents: number
  durationMin: number
}

export interface JobInput {
  customerId: string
  vehicleId: string
  scheduledAt: Date
  /** Catalog services, in display order — snapshotted server-side at save time. */
  serviceIds: string[]
  /** One-off lines ("pet hair removal +$40") that aren't in the catalog. */
  customLines: CustomLineInput[]
  /** Explicit duration override; null derives it from the line items. */
  durationMin: number | null
  notes: string
  internalNotes: string
  discountCents: number
}

/** The include pages and ops share for a full job view. */
export const jobInclude = {
  customer: true,
  vehicle: true,
  items: { orderBy: { sort: 'asc' } },
  photos: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.JobInclude

export type JobWithRelations = Prisma.JobGetPayload<{ include: typeof jobInclude }>

type ItemRow = {
  serviceId: string | null
  name: string
  priceCents: number
  durationMin: number
  sort: number
}

/**
 * Line items snapshot the catalog at save time. Prices and durations come from
 * the Service rows on the server — never from the client — so a tampered form
 * can pick services but not reprice them.
 */
async function buildItems(
  serviceIds: string[],
  customLines: CustomLineInput[],
): Promise<ItemRow[]> {
  const services = await prisma.service.findMany({ where: { id: { in: serviceIds } } })
  const byId = new Map(services.map((s) => [s.id, s]))
  const items: ItemRow[] = []
  let sort = 0
  for (const id of serviceIds) {
    const service = byId.get(id)
    if (!service) throw new Error('Unknown service on job')
    items.push({
      serviceId: service.id,
      name: service.name,
      priceCents: service.priceCents,
      durationMin: service.durationMin,
      sort: sort++,
    })
  }
  for (const line of customLines) {
    items.push({ serviceId: null, ...line, sort: sort++ })
  }
  if (items.length === 0) throw new Error('A job needs at least one service or line item')
  return items
}

function deriveDuration(override: number | null, items: ItemRow[]): number {
  if (override !== null && override >= 15) return override
  const sum = items.reduce((total, item) => total + item.durationMin, 0)
  return Math.max(sum, 30)
}

async function assertVehicleBelongsToCustomer(vehicleId: string, customerId: string) {
  const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId } })
  if (!vehicle || vehicle.customerId !== customerId) {
    throw new Error('Vehicle does not belong to that customer')
  }
}

export async function createJob(input: JobInput): Promise<Job> {
  await assertVehicleBelongsToCustomer(input.vehicleId, input.customerId)
  const items = await buildItems(input.serviceIds, input.customLines)
  return prisma.job.create({
    data: {
      customerId: input.customerId,
      vehicleId: input.vehicleId,
      scheduledAt: input.scheduledAt,
      durationMin: deriveDuration(input.durationMin, items),
      notes: input.notes,
      internalNotes: input.internalNotes,
      discountCents: input.discountCents,
      items: { create: items },
    },
  })
}

export async function updateJob(id: string, input: JobInput): Promise<Job> {
  await assertVehicleBelongsToCustomer(input.vehicleId, input.customerId)
  const items = await buildItems(input.serviceIds, input.customLines)
  return prisma.$transaction(async (tx) => {
    await tx.jobItem.deleteMany({ where: { jobId: id } })
    return tx.job.update({
      where: { id },
      data: {
        customerId: input.customerId,
        vehicleId: input.vehicleId,
        scheduledAt: input.scheduledAt,
        durationMin: deriveDuration(input.durationMin, items),
        notes: input.notes,
        internalNotes: input.internalNotes,
        discountCents: input.discountCents,
        items: { create: items },
      },
    })
  })
}

// target status → statuses it may come from
const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  SCHEDULED: ['IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW'],
  IN_PROGRESS: ['SCHEDULED'],
  COMPLETED: ['SCHEDULED', 'IN_PROGRESS'],
  CANCELED: ['SCHEDULED', 'IN_PROGRESS'],
  NO_SHOW: ['SCHEDULED'],
}

/** The status buttons a job's page should offer from its current status. */
export function availableTransitions(from: JobStatus): JobStatus[] {
  return (Object.keys(TRANSITIONS) as JobStatus[]).filter((target) =>
    TRANSITIONS[target].includes(from),
  )
}

export async function setJobStatus(id: string, status: JobStatus): Promise<Job> {
  const job = await prisma.job.findUniqueOrThrow({ where: { id } })
  if (job.status === status) return job
  if (!TRANSITIONS[status].includes(job.status)) {
    throw new Error(`Cannot move a ${job.status.toLowerCase()} job to ${status.toLowerCase()}`)
  }
  return prisma.job.update({
    where: { id },
    data: {
      status,
      completedAt:
        status === 'COMPLETED'
          ? (job.completedAt ?? new Date())
          : status === 'SCHEDULED'
            ? null
            : job.completedAt,
    },
  })
}

export async function recordPayment(
  id: string,
  payment: { method: PaymentMethod; tipCents: number },
): Promise<Job> {
  return prisma.job.update({
    where: { id },
    data: { paidAt: new Date(), paymentMethod: payment.method, tipCents: payment.tipCents },
  })
}

export async function clearPayment(id: string): Promise<Job> {
  return prisma.job.update({
    where: { id },
    data: { paidAt: null, paymentMethod: null, tipCents: 0 },
  })
}

/**
 * Assigns the next invoice number exactly once per job. The Settings counter
 * update takes a row lock, so concurrent calls serialize; a lost race wastes a
 * number, never reuses one.
 */
export async function ensureInvoice(id: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.job.findUniqueOrThrow({
      where: { id },
      select: { invoiceNumber: true },
    })
    if (existing.invoiceNumber !== null) return existing.invoiceNumber
    await tx.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })
    const settings = await tx.settings.update({
      where: { id: 1 },
      data: { nextInvoiceNumber: { increment: 1 } },
    })
    const number = settings.nextInvoiceNumber - 1
    await tx.job.update({
      where: { id },
      data: { invoiceNumber: number, invoicedAt: new Date() },
    })
    return number
  })
}

/** Removes the job, its lines, and its photos — including the files on disk. */
export async function deleteJob(id: string): Promise<void> {
  const photos = await prisma.photo.findMany({ where: { jobId: id } })
  await prisma.job.delete({ where: { id } })
  for (const photo of photos) {
    await deleteUploadFile(photo.filename)
  }
}
