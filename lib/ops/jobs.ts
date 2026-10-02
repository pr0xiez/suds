import { assertScheduleAvailable, lockBusinessSchedule } from '@/lib/bookingSchedule'
import { prisma } from '@/lib/db/client'
import type { Booking, Job, Prisma } from '@/lib/generated/prisma/client'
import type { JobStatus, PaymentMethod } from '@/lib/generated/prisma/enums'
import {
  type BookingView,
  bookingViewChanged,
  type CustomLineInput,
  deriveDuration,
  type JobLine,
  type LineSnapshot,
  reconcileJobLines,
} from '@/lib/jobLines'
import { bookingServices, queueBookingNotice } from '@/lib/ops/bookings'
import { deleteUploadFile } from '@/lib/uploads'

export type { CustomLineInput }

export interface JobInput {
  customerId: string
  vehicleId: string
  scheduledAt: Date
  /**
   * Catalog services. A service already on the job keeps its stored line; any other one is
   * snapshotted server-side from the active catalog at save time.
   */
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

/**
 * Line items snapshot the catalog when a service is added. Prices and durations come from the
 * job's stored lines or the Service rows on the server — never from the client — so a tampered
 * form can pick services but not reprice them.
 */
async function buildItems(
  db: Prisma.TransactionClient,
  businessId: string,
  booked: readonly LineSnapshot[],
  input: Pick<JobInput, 'serviceIds' | 'customLines'>,
): Promise<JobLine[]> {
  const services = await db.service.findMany({
    where: { businessId, id: { in: input.serviceIds }, active: true },
  })
  return reconcileJobLines(
    booked,
    input.serviceIds,
    input.customLines,
    new Map(services.map((service) => [service.id, service])),
  )
}

async function assertVehicleBelongsToCustomer(
  businessId: string,
  vehicleId: string,
  customerId: string,
) {
  const vehicle = await prisma.vehicle.findUnique({
    where: { businessId_id: { businessId, id: vehicleId } },
  })
  if (!vehicle || vehicle.customerId !== customerId) {
    throw new Error('Vehicle does not belong to that customer')
  }
}

export async function createJob(businessId: string, input: JobInput): Promise<Job> {
  await assertVehicleBelongsToCustomer(businessId, input.vehicleId, input.customerId)
  const items = await buildItems(prisma, businessId, [], input)
  return prisma.$transaction(
    async (tx) => {
      await assertScheduleAvailable(
        tx,
        businessId,
        input.scheduledAt,
        deriveDuration(input.durationMin, items),
      )
      return tx.job.create({
        data: {
          businessId,
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
    },
    { timeout: 20_000, maxWait: 20_000 },
  )
}

export async function updateJob(businessId: string, id: string, input: JobInput): Promise<Job> {
  await assertVehicleBelongsToCustomer(businessId, input.vehicleId, input.customerId)
  return prisma.$transaction(
    async (tx) => {
      await lockBusinessSchedule(tx, businessId)
      const existing = await tx.job.findUniqueOrThrow({
        where: { businessId_id: { businessId, id } },
        include: { booking: true, items: { orderBy: { sort: 'asc' } } },
      })
      if (
        existing.booking &&
        (input.customerId !== existing.customerId || input.vehicleId !== existing.vehicleId)
      )
        throw new Error('A customer booking cannot be reassigned to another customer or vehicle')
      // Lines already on the job keep their snapshot; only services added now read the catalog.
      const items = await buildItems(tx, businessId, existing.items, input)
      const durationMin = deriveDuration(input.durationMin, items)
      const timeChanged =
        input.scheduledAt.getTime() !== existing.scheduledAt.getTime() ||
        durationMin !== existing.durationMin
      // An edit that keeps the job's time skips the calendar; a new time only needs its added part free.
      if (timeChanged && !RELEASED.includes(existing.status))
        await assertScheduleAvailable(tx, businessId, input.scheduledAt, durationMin, {
          excludeJobId: id,
          excludeBookingId: existing.booking?.id,
          held: existing,
        })
      await tx.jobItem.deleteMany({ where: { jobId: id } })
      const job = await tx.job.update({
        where: { businessId_id: { businessId, id } },
        data: {
          customerId: input.customerId,
          vehicleId: input.vehicleId,
          scheduledAt: input.scheduledAt,
          durationMin,
          notes: input.notes,
          internalNotes: input.internalNotes,
          discountCents: input.discountCents,
          items: { create: items },
        },
      })
      if (existing.booking) {
        const sync = {
          scheduledAt: job.scheduledAt,
          durationMin: job.durationMin,
          serviceSnapshots: items,
          priceCents: Math.max(
            0,
            items.reduce((sum, line) => sum + line.priceCents, 0) - job.discountCents,
          ),
          address: job.locationAddress,
          waterPowerNotes: job.waterPowerNotes,
          customerNotes: job.notes,
        }
        // Rewriting the booking would also void its queued reminder, so an edit the customer
        // cannot see (private notes, say) leaves the booking and its notices alone.
        if (
          bookingViewChanged(bookingView(existing.booking), {
            ...sync,
            lines: sync.serviceSnapshots,
          })
        ) {
          const booking = await tx.booking.update({
            where: { id: existing.booking.id },
            data: sync,
          })
          await queueBookingNotice(tx, booking, 'updated')
        }
      }
      return job
    },
    { timeout: 20_000 },
  )
}

function bookingView(booking: Booking): BookingView {
  let lines: LineSnapshot[] | null
  try {
    lines = bookingServices(booking.serviceSnapshots)
  } catch {
    lines = null
  }
  return { ...booking, lines }
}

/** Statuses whose time no longer counts as busy on the calendar. */
const RELEASED: JobStatus[] = ['CANCELED', 'NO_SHOW']

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

export async function setJobStatus(
  businessId: string,
  id: string,
  status: JobStatus,
): Promise<Job> {
  return prisma.$transaction(
    async (tx) => {
      await lockBusinessSchedule(tx, businessId)
      const job = await tx.job.findUniqueOrThrow({
        where: { businessId_id: { businessId, id } },
        include: { booking: true },
      })
      if (job.status === status) return job
      if (!TRANSITIONS[status].includes(job.status)) {
        throw new Error(`Cannot move a ${job.status.toLowerCase()} job to ${status.toLowerCase()}`)
      }
      // Only reopening a canceled or no-show job claims its time again; other moves already hold it.
      if (RELEASED.includes(job.status) && !RELEASED.includes(status))
        await assertScheduleAvailable(tx, businessId, job.scheduledAt, job.durationMin, {
          excludeJobId: id,
          excludeBookingId: job.booking?.id,
        })
      const updated = await tx.job.update({
        where: { businessId_id: { businessId, id } },
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
      if (job.booking) {
        const booking = await tx.booking.update({
          where: { id: job.booking.id },
          data: {
            status: status === 'CANCELED' || status === 'NO_SHOW' ? 'CANCELED' : 'CONFIRMED',
          },
        })
        await queueBookingNotice(tx, booking, status.toLowerCase())
      }
      return updated
    },
    { timeout: 20_000 },
  )
}

export async function recordPayment(
  businessId: string,
  id: string,
  payment: { method: PaymentMethod; tipCents: number },
): Promise<Job> {
  return prisma.job.update({
    where: { businessId_id: { businessId, id } },
    data: { paidAt: new Date(), paymentMethod: payment.method, tipCents: payment.tipCents },
  })
}

export async function clearPayment(businessId: string, id: string): Promise<Job> {
  return prisma.job.update({
    where: { businessId_id: { businessId, id } },
    data: { paidAt: null, paymentMethod: null, tipCents: 0 },
  })
}

/**
 * Assigns the next invoice number exactly once per job. The Settings counter
 * update takes a row lock, so concurrent calls serialize; a lost race wastes a
 * number, never reuses one.
 */
export async function ensureInvoice(businessId: string, id: string): Promise<number> {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.job.findUniqueOrThrow({
      where: { businessId_id: { businessId, id } },
      select: { invoiceNumber: true },
    })
    if (existing.invoiceNumber !== null) return existing.invoiceNumber
    await tx.settings.upsert({ where: { businessId }, update: {}, create: { businessId } })
    const settings = await tx.settings.update({
      where: { businessId },
      data: { nextInvoiceNumber: { increment: 1 } },
    })
    const recheck = await tx.job.findUniqueOrThrow({
      where: { businessId_id: { businessId, id } },
      select: { invoiceNumber: true },
    })
    if (recheck.invoiceNumber !== null) return recheck.invoiceNumber
    const number = settings.nextInvoiceNumber - 1
    await tx.job.update({
      where: { businessId_id: { businessId, id } },
      data: { invoiceNumber: number, invoicedAt: new Date() },
    })
    return number
  })
}

/** Removes the job, its lines, and its photos — including the files on disk. */
export async function deleteJob(businessId: string, id: string): Promise<void> {
  const photos = await prisma.$transaction(
    async (tx) => {
      await lockBusinessSchedule(tx, businessId)
      const job = await tx.job.findUniqueOrThrow({
        where: { businessId_id: { businessId, id } },
        include: { booking: true, photos: true },
      })
      if (job.booking) {
        const booking = await tx.booking.update({
          where: { id: job.booking.id },
          data: { status: 'CANCELED' },
        })
        await queueBookingNotice(tx, booking, 'canceled')
      }
      await tx.job.delete({ where: { businessId_id: { businessId, id } } })
      return job.photos
    },
    { timeout: 20_000 },
  )
  for (const photo of photos) await deleteUploadFile(photo.filename)
}
