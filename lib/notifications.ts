import { lockBusinessSchedule } from '@/lib/bookingSchedule'
import { prisma } from '@/lib/db/client'
import type { Prisma } from '@/lib/generated/prisma/client'

export interface EmailInput {
  businessId?: string | null
  to: string
  subject: string
  text: string
  dedupeKey: string
  availableAt?: Date
}

/** Insert in the same transaction as the business event. Sending happens in the worker. */
export async function queueEmail(tx: Prisma.TransactionClient, input: EmailInput) {
  return tx.notificationOutbox.upsert({
    where: { dedupeKey: input.dedupeKey },
    update: {},
    create: input,
  })
}

export function publicAppUrl(): URL {
  const value = process.env.PUBLIC_APP_URL
  if (!value) throw new Error('PUBLIC_APP_URL must be configured')
  const url = new URL(value)
  if (
    url.username ||
    url.password ||
    (url.protocol !== 'https:' &&
      !(
        process.env.NODE_ENV !== 'production' &&
        url.protocol === 'http:' &&
        ['localhost', '127.0.0.1'].includes(url.hostname)
      ))
  )
    throw new Error('PUBLIC_APP_URL must be an HTTPS origin')
  if (url.pathname !== '/' || url.search || url.hash)
    throw new Error('PUBLIC_APP_URL must be an origin')
  return url
}

/** Resend-compatible HTTP adapter; never invoked by a page request. */
export async function processNotificationOutbox(
  limit = 10,
): Promise<{ sent: number; failed: number }> {
  const endpoint = process.env.EMAIL_PROVIDER_URL
  const token = process.env.EMAIL_PROVIDER_TOKEN
  const from = process.env.EMAIL_FROM
  if (!endpoint || !token || !from) return { sent: 0, failed: 0 }
  const url = new URL(endpoint)
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('EMAIL_PROVIDER_URL must use HTTPS')
  let sent = 0
  let failed = 0
  // Failed sends retry with the same provider idempotency key. Terminal failures stay inspectable.
  for (let i = 0; i < Math.min(Math.max(limit, 1), 50); i++) {
    const row = await prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT "id" FROM "NotificationOutbox"
        WHERE ("status" = 'PENDING' AND "availableAt" <= CURRENT_TIMESTAMP)
          OR ("status" = 'PROCESSING' AND "lockedAt" < CURRENT_TIMESTAMP - INTERVAL '5 minutes')
        ORDER BY "availableAt" FOR UPDATE SKIP LOCKED LIMIT 1`
      if (!rows[0]) return null
      return tx.notificationOutbox.update({
        where: { id: rows[0].id },
        data: { status: 'PROCESSING', lockedAt: new Date(), attempts: { increment: 1 } },
      })
    })
    if (!row) break
    try {
      // Recheck under the writers' locks, then release them before the provider call so a slow
      // provider never stalls bookings. A change after this check queues its own notice.
      const deliverable = await prisma.$transaction(
        async (tx) => {
          if (row.dedupeKey.startsWith('account:')) {
            let accountToken = await tx.accountToken.findUnique({
              where: { id: row.dedupeKey.slice('account:'.length) },
              include: { user: { select: { active: true } } },
            })
            if (
              accountToken?.purpose === 'CUSTOMER_LINK' &&
              accountToken.businessId &&
              accountToken.customerId
            ) {
              await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "businessId" = ${accountToken.businessId} AND "id" = ${accountToken.customerId} FOR UPDATE`
              accountToken = await tx.accountToken.findUnique({
                where: { id: row.dedupeKey.slice('account:'.length) },
                include: { user: { select: { active: true } } },
              })
            }
            if (
              !accountToken ||
              accountToken.consumedAt ||
              accountToken.expiresAt <= new Date() ||
              !accountToken.user.active
            ) {
              await tx.notificationOutbox.update({
                where: { id: row.id },
                data: { status: 'CANCELED', lockedAt: null },
              })
              return false
            }
          }
          const bookingMatch = /^booking:([^:]+):/.exec(row.dedupeKey)
          if (bookingMatch && row.businessId) {
            await lockBusinessSchedule(tx, row.businessId)
            const booking = await tx.booking.findFirst({
              where: { id: bookingMatch[1], businessId: row.businessId },
              include: { job: { select: { status: true } } },
            })
            const reminder = /:reminder:(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/.exec(
              row.dedupeKey,
            )
            if (
              !booking ||
              (reminder &&
                (booking.status !== 'CONFIRMED' ||
                  booking.scheduledAt.toISOString() !== reminder[1] ||
                  booking.job?.status !== 'SCHEDULED' ||
                  !row.dedupeKey.endsWith(`:v${booking.updatedAt.toISOString()}`)))
            ) {
              await tx.notificationOutbox.update({
                where: { id: row.id },
                data: { status: 'CANCELED', lockedAt: null },
              })
              return false
            }
          }
          const current = await tx.notificationOutbox.findUnique({ where: { id: row.id } })
          return current?.status === 'PROCESSING'
        },
        { timeout: 20_000, maxWait: 20_000 },
      )
      if (!deliverable) continue
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': row.dedupeKey,
        },
        body: JSON.stringify({ from, to: [row.to], subject: row.subject, text: row.text }),
        signal: AbortSignal.timeout(15_000),
      })
      if (!res.ok) throw new Error(`Email provider returned HTTP ${res.status}`)
      // Unconditional: the message went out even if a change canceled the row mid-send.
      await prisma.notificationOutbox.update({
        where: { id: row.id },
        data: { status: 'SENT', sentAt: new Date(), lockedAt: null, lastError: null },
      })
      sent++
    } catch {
      await prisma.notificationOutbox.updateMany({
        where: { id: row.id, status: 'PROCESSING' },
        data: {
          status: row.attempts >= 5 ? 'FAILED' : 'PENDING',
          lockedAt: null,
          lastError: 'Email delivery failed; retrying with the same idempotency key.',
          availableAt: new Date(Date.now() + Math.min(60 * 60_000, 60_000 * 2 ** row.attempts)),
        },
      })
      failed++
    }
  }
  return { sent, failed }
}
