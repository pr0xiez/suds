import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => {
  const tx = {
    job: { updateMany: vi.fn(), findUnique: vi.fn(), findUniqueOrThrow: vi.fn(), update: vi.fn() },
  }
  return {
    tx,
    prisma: {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) =>
        callback(tx),
      ),
    },
  }
})
vi.mock('@/lib/db/client', () => ({ prisma: db.prisma }))
vi.mock('@/lib/bookingSchedule', () => ({
  lockBusinessSchedule: vi.fn(),
  assertScheduleAvailable: vi.fn(),
}))

import { clearPayment, recordPayment, setJobStatus } from '@/lib/ops/jobs'

const paid = { method: 'CASH', tipCents: 500 } as const

beforeEach(() => {
  for (const fn of Object.values(db.tx.job)) fn.mockReset()
})

describe('recordPayment', () => {
  it('only updates an unpaid completed job in the same business', async () => {
    db.tx.job.updateMany.mockResolvedValue({ count: 1 })
    db.tx.job.findUniqueOrThrow.mockResolvedValue({ id: 'j1' })
    await recordPayment('b1', 'j1', paid)
    expect(db.tx.job.updateMany).toHaveBeenCalledWith({
      where: { businessId: 'b1', id: 'j1', paidAt: null, status: 'COMPLETED' },
      data: { paidAt: expect.any(Date), paymentMethod: 'CASH', tipCents: 500 },
    })
  })

  it('rejects a double payment', async () => {
    db.tx.job.updateMany.mockResolvedValue({ count: 0 })
    db.tx.job.findUnique.mockResolvedValue({ status: 'COMPLETED', paidAt: new Date() })
    await expect(recordPayment('b1', 'j1', paid)).rejects.toThrow('already marked paid')
  })

  it('rejects payment on a canceled job', async () => {
    db.tx.job.updateMany.mockResolvedValue({ count: 0 })
    db.tx.job.findUnique.mockResolvedValue({ status: 'CANCELED', paidAt: null })
    await expect(recordPayment('b1', 'j1', paid)).rejects.toThrow('Only a completed job')
  })

  it('rejects a job outside the business', async () => {
    db.tx.job.updateMany.mockResolvedValue({ count: 0 })
    db.tx.job.findUnique.mockResolvedValue(null)
    await expect(recordPayment('b2', 'j1', paid)).rejects.toThrow('Job not found')
  })

  it.each([-1, 1.5, Number.NaN, 1_000_001])(
    'rejects tip %s without touching the job',
    async (tip) => {
      await expect(recordPayment('b1', 'j1', { ...paid, tipCents: tip })).rejects.toThrow('tip')
      expect(db.tx.job.updateMany).not.toHaveBeenCalled()
    },
  )
})

describe('clearPayment', () => {
  it('requires an existing payment', async () => {
    db.tx.job.updateMany.mockResolvedValue({ count: 0 })
    db.tx.job.findUnique.mockResolvedValue({ id: 'j1' })
    await expect(clearPayment('b1', 'j1')).rejects.toThrow('not marked paid')
    expect(db.tx.job.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { businessId: 'b1', id: 'j1', paidAt: { not: null } },
      }),
    )
  })
})

describe('setJobStatus', () => {
  it('will not reopen a paid completed job', async () => {
    db.tx.job.findUniqueOrThrow.mockResolvedValue({
      status: 'COMPLETED',
      paidAt: new Date(),
      booking: null,
    })
    await expect(setJobStatus('b1', 'j1', 'SCHEDULED')).rejects.toThrow('Clear the payment')
    expect(db.tx.job.update).not.toHaveBeenCalled()
  })
})
