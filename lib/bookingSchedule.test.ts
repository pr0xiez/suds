import { describe, expect, it, vi } from 'vitest'
import { assertScheduleAvailable, scheduleBusyIntervals } from '@/lib/bookingSchedule'
import type { Prisma } from '@/lib/generated/prisma/client'

function fakeTx(jobs: Array<{ scheduledAt: Date; durationMin: number }> = []) {
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: 'business-a' }]),
    settings: { findUniqueOrThrow: vi.fn(async () => ({ travelBufferMin: 30 })) },
    job: { findMany: vi.fn(async () => jobs) },
    booking: { findMany: vi.fn(async () => []) },
    availabilityBlock: { findMany: vi.fn(async () => []) },
  }
  return tx
}

describe('shared schedule reservation guard', () => {
  it('locks before it reads competing reservations and rejects a travel-buffer conflict', async () => {
    const tx = fakeTx([{ scheduledAt: new Date('2026-10-01T13:00:00Z'), durationMin: 60 }])
    await expect(
      assertScheduleAvailable(
        tx as unknown as Prisma.TransactionClient,
        'business-a',
        new Date('2026-10-01T14:15:00Z'),
        60,
      ),
    ).rejects.toThrow('taken')
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.job.findMany.mock.invocationCallOrder[0] ?? 0,
    )
    await expect(
      assertScheduleAvailable(
        tx as unknown as Prisma.TransactionClient,
        'business-a',
        new Date('2026-10-01T14:30:00Z'),
        60,
      ),
    ).resolves.toBeUndefined()
  })

  it('scopes every read and excludes both sides of the booking/job association for edits', async () => {
    const tx = fakeTx()
    await scheduleBusyIntervals(tx as unknown as Prisma.TransactionClient, 'business-a', {
      excludeJobId: 'own-job',
      excludeBookingId: 'own-booking',
    })
    expect(tx.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ businessId: 'business-a', id: { not: 'own-job' } }),
      }),
    )
    expect(tx.booking.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          businessId: 'business-a',
          id: { not: 'own-booking' },
          OR: expect.arrayContaining([
            expect.objectContaining({ status: 'PENDING', reservedUntil: { gt: expect.any(Date) } }),
          ]),
        }),
      }),
    )
    expect(tx.availabilityBlock.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { businessId: 'business-a' } }),
    )
  })
})
