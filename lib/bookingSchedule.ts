import {
  type BusyInterval,
  MAX_APPOINTMENT_MIN,
  overlaps,
  reservationInterval,
  storedInterval,
} from '@/lib/bookingAvailability'
import { dayBoundsUtc, parseDateKey } from '@/lib/dates'
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

export interface ScheduleScope {
  /** Only reservations overlapping this range are read. */
  window: BusyInterval
  excludeJobId?: string
  excludeBookingId?: string
}

/** UTC bounds of one business-local day; null for a malformed key. */
export function dayWindow(day: string, timezone: string): BusyInterval | null {
  const wall = parseDateKey(day)
  return wall ? dayBoundsUtc(wall, timezone) : null
}

export async function scheduleBusyIntervals(
  tx: Prisma.TransactionClient,
  businessId: string,
  scope: ScheduleScope,
): Promise<BusyInterval[]> {
  const settings = await tx.settings.findUniqueOrThrow({ where: { businessId } })
  const { window } = scope
  // Validated reservations end within MAX_APPOINTMENT_MIN plus the buffer of their start, so an
  // indexed start-time range finds them. Legacy rows can be longer and are matched by duration.
  const earliestStart = new Date(
    window.start.getTime() - (MAX_APPOINTMENT_MIN + settings.travelBufferMin) * 60_000,
  )
  const reachesWindow = {
    scheduledAt: { lt: window.end },
    OR: [{ scheduledAt: { gte: earliestStart } }, { durationMin: { gt: MAX_APPOINTMENT_MIN } }],
  }
  const [jobs, requests, blocks] = await Promise.all([
    tx.job.findMany({
      where: {
        businessId,
        status: { notIn: ['CANCELED', 'NO_SHOW'] },
        ...(scope.excludeJobId ? { id: { not: scope.excludeJobId } } : {}),
        ...reachesWindow,
      },
      select: { scheduledAt: true, durationMin: true },
    }),
    tx.booking.findMany({
      where: {
        businessId,
        ...(scope.excludeBookingId ? { id: { not: scope.excludeBookingId } } : {}),
        AND: [
          {
            OR: [
              { status: 'PENDING', reservedUntil: { gt: new Date() } },
              { status: 'CONFIRMED', jobId: null },
            ],
          },
          reachesWindow,
        ],
      },
      select: { scheduledAt: true, durationMin: true },
    }),
    tx.availabilityBlock.findMany({
      where: { businessId, startsAt: { lt: window.end }, endsAt: { gt: window.start } },
      select: { startsAt: true, endsAt: true },
    }),
  ])
  return [
    ...[...jobs, ...requests].map((row) =>
      storedInterval(row.scheduledAt, row.durationMin, settings.travelBufferMin),
    ),
    ...blocks.map((block) => ({ start: block.startsAt, end: block.endsAt })),
  ].filter((interval) => overlaps(interval, window))
}

/** The parts of `next` outside `held`: the time a change newly claims. */
function newlyClaimed(next: BusyInterval, held: BusyInterval | null): BusyInterval[] {
  if (!held || !overlaps(next, held)) return [next]
  return [
    { start: next.start, end: new Date(Math.min(next.end.getTime(), held.start.getTime())) },
    { start: new Date(Math.max(next.start.getTime(), held.end.getTime())), end: next.end },
  ].filter((part) => part.start < part.end)
}

export async function assertScheduleAvailable(
  tx: Prisma.TransactionClient,
  businessId: string,
  start: Date,
  durationMin: number,
  options: {
    excludeJobId?: string
    excludeBookingId?: string
    /**
     * The reservation this change replaces. Time it already held stays valid even if
     * something has since been placed over it; only newly claimed time must be free.
     */
    held?: { scheduledAt: Date; durationMin: number }
  } = {},
): Promise<void> {
  await lockBusinessSchedule(tx, businessId)
  const settings = await tx.settings.findUniqueOrThrow({ where: { businessId } })
  const proposed = reservationInterval(start, durationMin, settings.travelBufferMin)
  const held = options.held
    ? storedInterval(options.held.scheduledAt, options.held.durationMin, settings.travelBufferMin)
    : null
  const claimed = newlyClaimed(proposed, held)
  if (claimed.length === 0) return
  const busy = await scheduleBusyIntervals(tx, businessId, {
    window: proposed,
    excludeJobId: options.excludeJobId,
    excludeBookingId: options.excludeBookingId,
  })
  if (busy.some((interval) => claimed.some((part) => overlaps(part, interval)))) {
    throw new Error('That time has just been taken or is blocked. Choose another time.')
  }
}
