import { describe, expect, it, vi } from 'vitest'
import { assertScheduleAvailable, dayWindow, scheduleBusyIntervals } from '@/lib/bookingSchedule'
import type { Prisma } from '@/lib/generated/prisma/client'

type Row = { scheduledAt: Date; durationMin: number }

function fakeTx(jobs: Row[] = [], blocks: Array<{ startsAt: Date; endsAt: Date }> = []) {
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: 'business-a' }]),
    settings: { findUniqueOrThrow: vi.fn(async () => ({ travelBufferMin: 30 })) },
    job: { findMany: vi.fn(async () => jobs) },
    booking: { findMany: vi.fn(async () => []) },
    availabilityBlock: { findMany: vi.fn(async () => blocks) },
  }
  return tx
}

const asTx = (tx: ReturnType<typeof fakeTx>) => tx as unknown as Prisma.TransactionClient
const at = (iso: string) => new Date(iso)

describe('shared schedule reservation guard', () => {
  it('locks before it reads competing reservations and rejects a travel-buffer conflict', async () => {
    const tx = fakeTx([{ scheduledAt: at('2026-10-01T13:00:00Z'), durationMin: 60 }])
    await expect(
      assertScheduleAvailable(asTx(tx), 'business-a', at('2026-10-01T14:15:00Z'), 60),
    ).rejects.toThrow('taken')
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.job.findMany.mock.invocationCallOrder[0] ?? 0,
    )
    await expect(
      assertScheduleAvailable(asTx(tx), 'business-a', at('2026-10-01T14:30:00Z'), 60),
    ).resolves.toBeUndefined()
  })

  it('scopes every read to the business and window and excludes both sides of an edit', async () => {
    const tx = fakeTx()
    const window = { start: at('2026-10-01T04:00:00Z'), end: at('2026-10-02T04:00:00Z') }
    await scheduleBusyIntervals(asTx(tx), 'business-a', {
      window,
      excludeJobId: 'own-job',
      excludeBookingId: 'own-booking',
    })
    const reaches = {
      scheduledAt: { lt: window.end },
      OR: [
        // 1440-minute appointment plus the 30-minute buffer.
        { scheduledAt: { gte: at('2026-09-30T03:30:00Z') } },
        { durationMin: { gt: 1440 } },
      ],
    }
    expect(tx.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'business-a',
          id: { not: 'own-job' },
          ...reaches,
        }),
      }),
    )
    expect(tx.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'business-a',
          id: { not: 'own-booking' },
          AND: [
            {
              OR: expect.arrayContaining([
                expect.objectContaining({
                  status: 'PENDING',
                  reservedUntil: { gt: expect.any(Date) },
                }),
              ]),
            },
            reaches,
          ],
        }),
      }),
    )
    expect(tx.availabilityBlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          businessId: 'business-a',
          startsAt: { lt: window.end },
          endsAt: { gt: window.start },
        },
      }),
    )
  })

  it('tolerates legacy multi-day jobs and still treats their whole span as busy', async () => {
    const tx = fakeTx([{ scheduledAt: at('2026-10-01T13:00:00Z'), durationMin: 2880 }])
    await expect(
      assertScheduleAvailable(asTx(tx), 'business-a', at('2026-10-02T15:00:00Z'), 60),
    ).rejects.toThrow('taken')
    await expect(
      assertScheduleAvailable(asTx(tx), 'business-a', at('2026-10-03T13:30:00Z'), 60),
    ).resolves.toBeUndefined()
  })

  it('ignores rows the query returns outside the window', async () => {
    const tx = fakeTx(
      [{ scheduledAt: at('2026-10-01T09:00:00Z'), durationMin: 60 }],
      [{ startsAt: at('2026-10-01T20:00:00Z'), endsAt: at('2026-10-01T21:00:00Z') }],
    )
    const busy = await scheduleBusyIntervals(asTx(tx), 'business-a', {
      window: { start: at('2026-10-01T12:00:00Z'), end: at('2026-10-01T18:00:00Z') },
    })
    expect(busy).toEqual([])
  })

  it('lets an edit keep time it already held but not claim new overlapping time', async () => {
    // A sick-day block placed over an existing 13:00–14:00 job after it was booked.
    const tx = fakeTx(
      [],
      [{ startsAt: at('2026-10-01T12:00:00Z'), endsAt: at('2026-10-01T18:00:00Z') }],
    )
    const held = { scheduledAt: at('2026-10-01T13:00:00Z'), durationMin: 60 }
    await expect(
      assertScheduleAvailable(asTx(tx), 'business-a', at('2026-10-01T13:15:00Z'), 30, { held }),
    ).resolves.toBeUndefined()
    await expect(
      assertScheduleAvailable(asTx(tx), 'business-a', at('2026-10-01T13:00:00Z'), 120, { held }),
    ).rejects.toThrow('taken')
    await expect(
      assertScheduleAvailable(asTx(tx), 'business-a', at('2026-10-01T12:30:00Z'), 60, { held }),
    ).rejects.toThrow('taken')
    // Moving away entirely only needs the new time to be free.
    await expect(
      assertScheduleAvailable(asTx(tx), 'business-a', at('2026-10-01T19:00:00Z'), 60, { held }),
    ).resolves.toBeUndefined()
  })

  it('still validates the duration of a new reservation', async () => {
    const tx = fakeTx()
    await expect(
      assertScheduleAvailable(asTx(tx), 'business-a', at('2026-10-01T13:00:00Z'), 1441),
    ).rejects.toThrow('duration')
  })
})

describe('dayWindow', () => {
  it('covers one business-local day, including DST changes', () => {
    expect(dayWindow('2026-10-01', 'America/New_York')).toEqual({
      start: at('2026-10-01T04:00:00Z'),
      end: at('2026-10-02T04:00:00Z'),
    })
    const fallBack = dayWindow('2026-11-01', 'America/New_York')
    expect(fallBack && (fallBack.end.getTime() - fallBack.start.getTime()) / 3600_000).toBe(25)
    expect(dayWindow('not-a-day', 'America/New_York')).toBeNull()
  })
})
