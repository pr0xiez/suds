import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => {
  let open = 0
  const tx = {
    $queryRaw: vi.fn(),
    booking: { findFirst: vi.fn() },
    notificationOutbox: { update: vi.fn(), findUnique: vi.fn() },
  }
  return {
    tx,
    openTransactions: () => open,
    prisma: {
      $transaction: vi.fn(async (callback: (client: typeof tx) => Promise<unknown>) => {
        open++
        try {
          return await callback(tx)
        } finally {
          open--
        }
      }),
      notificationOutbox: { update: vi.fn(), updateMany: vi.fn() },
    },
  }
})
vi.mock('@/lib/db/client', () => ({ prisma: db.prisma }))

import { processNotificationOutbox } from '@/lib/notifications'

const scheduledAt = new Date('2026-10-05T14:00:00.000Z')
const updatedAt = new Date('2026-10-01T12:00:00.000Z')
const row = {
  id: 'notice-1',
  businessId: 'business-a',
  to: 'customer@example.test',
  subject: 'Appointment confirmed',
  text: 'See you soon',
  dedupeKey: `booking:booking-1:confirmed:${scheduledAt.toISOString()}:v${updatedAt.toISOString()}`,
  attempts: 1,
}

describe('notification delivery', () => {
  beforeEach(() => {
    vi.stubEnv('EMAIL_PROVIDER_URL', 'https://mail.example.test/emails')
    vi.stubEnv('EMAIL_PROVIDER_TOKEN', 'test-token')
    vi.stubEnv('EMAIL_FROM', 'Suds <mail@example.test>')
    db.tx.$queryRaw
      .mockReset()
      .mockResolvedValueOnce([{ id: row.id }])
      .mockResolvedValue([{ id: row.businessId }])
    db.tx.notificationOutbox.update.mockReset().mockResolvedValue(row)
    db.tx.notificationOutbox.findUnique.mockReset().mockResolvedValue({ status: 'PROCESSING' })
    db.tx.booking.findFirst.mockReset().mockResolvedValue({
      status: 'CONFIRMED',
      scheduledAt,
      updatedAt,
      job: { status: 'SCHEDULED' },
    })
    db.prisma.notificationOutbox.update.mockReset().mockResolvedValue(row)
    db.prisma.notificationOutbox.updateMany.mockReset()
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it('rechecks the appointment under the calendar lock but calls the provider after releasing it', async () => {
    const fetch = vi.fn(async () => {
      expect(db.openTransactions()).toBe(0)
      return new Response('{}', { status: 200 })
    })
    vi.stubGlobal('fetch', fetch)
    await expect(processNotificationOutbox(1)).resolves.toEqual({ sent: 1, failed: 0 })
    // Claim, then the calendar lock taken inside the recheck transaction.
    expect(db.tx.$queryRaw).toHaveBeenCalledTimes(2)
    expect(fetch).toHaveBeenCalledOnce()
    expect(db.prisma.notificationOutbox.update).toHaveBeenCalledWith({
      where: { id: row.id },
      data: expect.objectContaining({ status: 'SENT', lockedAt: null }),
    })
  })

  it('cancels a notice whose booking is gone without contacting the provider', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    db.tx.booking.findFirst.mockResolvedValue(null)
    await expect(processNotificationOutbox(1)).resolves.toEqual({ sent: 0, failed: 0 })
    expect(fetch).not.toHaveBeenCalled()
    expect(db.tx.notificationOutbox.update).toHaveBeenLastCalledWith({
      where: { id: row.id },
      data: { status: 'CANCELED', lockedAt: null },
    })
  })

  it('sends every message to the redirect inbox, naming the intended recipient', async () => {
    vi.stubEnv('EMAIL_REDIRECT_TO', 'preview@example.test')
    const fetch = vi.fn(async (_url: URL, _init: RequestInit) => new Response('{}'))
    vi.stubGlobal('fetch', fetch)
    await expect(processNotificationOutbox(1)).resolves.toEqual({ sent: 1, failed: 0 })
    const body = JSON.parse(String(fetch.mock.calls[0]?.[1].body))
    expect(body.to).toEqual(['preview@example.test'])
    expect(body.subject).toBe(`[to ${row.to}] ${row.subject}`)
  })

  it('never sends from a Vercel preview without a redirect inbox', async () => {
    vi.stubEnv('VERCEL_ENV', 'preview')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    await expect(processNotificationOutbox(1)).resolves.toEqual({ sent: 0, failed: 0 })
    vi.stubEnv('EMAIL_REDIRECT_TO', 'not an address')
    await expect(processNotificationOutbox(1)).resolves.toEqual({ sent: 0, failed: 0 })
    expect(fetch).not.toHaveBeenCalled()
    expect(db.tx.notificationOutbox.update).not.toHaveBeenCalled()
  })

  it('returns a failed send to the queue for a retry', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 503 })),
    )
    await expect(processNotificationOutbox(1)).resolves.toEqual({ sent: 0, failed: 1 })
    expect(db.prisma.notificationOutbox.update).not.toHaveBeenCalled()
    expect(db.prisma.notificationOutbox.updateMany).toHaveBeenCalledWith({
      where: { id: row.id, status: 'PROCESSING' },
      data: expect.objectContaining({
        status: 'PENDING',
        lockedAt: null,
        attempts: { increment: 1 },
      }),
    })
  })

  it('logs only the failure code, never the message, when the provider fails', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 503 })),
    )
    await processNotificationOutbox(1)
    const logged = info.mock.calls.map((c) => String(c[0])).join('\n')
    expect(logged).toContain('notification.delivery_failed')
    expect(logged).toContain('http_503')
    expect(logged).not.toContain(row.to)
    info.mockRestore()
  })

  it('fails terminally on the fifth failed provider attempt', async () => {
    db.tx.notificationOutbox.update.mockResolvedValue({ ...row, attempts: 4 })
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 })),
    )
    await processNotificationOutbox(1)
    expect(db.prisma.notificationOutbox.updateMany).toHaveBeenCalledWith({
      where: { id: row.id, status: 'PROCESSING' },
      data: expect.objectContaining({ status: 'FAILED' }),
    })
  })

  it('does not consume a send attempt when the recheck hits a database error', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {})
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    db.tx.booking.findFirst.mockRejectedValue(
      new Error('connection lost for customer@example.test'),
    )
    await expect(processNotificationOutbox(1)).resolves.toEqual({ sent: 0, failed: 1 })
    expect(fetch).not.toHaveBeenCalled()
    expect(db.prisma.notificationOutbox.updateMany).not.toHaveBeenCalled()
    const logged = info.mock.calls.map((c) => String(c[0])).join('\n')
    expect(logged).toContain('notification.recheck_failed')
    expect(logged).not.toContain('customer@example.test')
    info.mockRestore()
  })
})
