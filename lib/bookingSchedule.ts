import { overlaps, reservationInterval } from '@/lib/bookingAvailability'
import type { Prisma } from '@/lib/generated/prisma/client'

/** All calendar writers lock the same business row before reading or reserving time. */
export async function lockBusinessSchedule(
  tx: Prisma.TransactionClient,
  businessId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT id FROM "Business" WHERE id = ${businessId} FOR UPDATE`
  if (rows.length !== 1) throw new Error('Business unavailable')
}

export async function scheduleBusyIntervals(
  tx: Prisma.TransactionClient,
  businessId: string,
  options: { excludeJobId?: string; excludeBookingId?: string } = {},
) {
  const settings = await tx.settings.findUniqueOrThrow({ where: { businessId } })
  const [jobs, requests, blocks] = await Promise.all([
    tx.job.findMany({
      where: {
        businessId,
        status: { notIn: ['CANCELED', 'NO_SHOW'] },
        ...(options.excludeJobId ? { id: { not: options.excludeJobId } } : {}),
      },
      select: { scheduledAt: true, durationMin: true },
    }),
    tx.booking.findMany({
      where: {
        businessId,
        ...(options.excludeBookingId ? { id: { not: options.excludeBookingId } } : {}),
        OR: [
          { status: 'PENDING', reservedUntil: { gt: new Date() } },
          { status: 'CONFIRMED', jobId: null },
        ],
      },
      select: { scheduledAt: true, durationMin: true },
    }),
    tx.availabilityBlock.findMany({
      where: { businessId },
      select: { startsAt: true, endsAt: true },
    }),
  ])
  return [
    ...jobs.map((job) =>
      reservationInterval(job.scheduledAt, job.durationMin, settings.travelBufferMin),
    ),
    ...requests.map((request) =>
      reservationInterval(request.scheduledAt, request.durationMin, settings.travelBufferMin),
    ),
    ...blocks.map((block) => ({ start: block.startsAt, end: block.endsAt })),
  ]
}

export async function assertScheduleAvailable(
  tx: Prisma.TransactionClient,
  businessId: string,
  start: Date,
  durationMin: number,
  options: { excludeJobId?: string; excludeBookingId?: string } = {},
): Promise<void> {
  await lockBusinessSchedule(tx, businessId)
  const settings = await tx.settings.findUniqueOrThrow({ where: { businessId } })
  const proposed = reservationInterval(start, durationMin, settings.travelBufferMin)
  const busy = await scheduleBusyIntervals(tx, businessId, options)
  if (busy.some((interval) => overlaps(proposed, interval))) {
    throw new Error('That time has just been taken or is blocked. Choose another time.')
  }
}
