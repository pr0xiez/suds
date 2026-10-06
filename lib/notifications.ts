import { lockBusinessSchedule } from '@/lib/bookingSchedule'
import { prisma } from '@/lib/db/client'
import type { Prisma } from '@/lib/generated/prisma/client'
import { logEvent } from '@/lib/observability'

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
    // Subjects carry owner-chosen business names; a subject is always one line.
    create: { ...input, subject: input.subject.replace(/[\r\n]+/g, ' ') },
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

/**
 * EMAIL_REDIRECT_TO sends every message to one inbox, with the intended recipient
 * moved into the subject, so a preview running on fixture data cannot reach a real
 * customer. Vercel previews refuse to send without it. Undefined means normal
 * delivery; null means nothing may be sent.
 */
export function emailRedirect(): string | null | undefined {
  const value = process.env.EMAIL_REDIRECT_TO?.trim()
  if (value) return /^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(value) ? value : null
  return process.env.VERCEL_ENV === 'preview' ? null : undefined
}

type OutboxRow = {
  id: string
  businessId: string | null
  to: string
  subject: string
  text: string
  dedupeKey: string
  attempts: number
}

/** Provider rejection. The status is the only detail logged; bodies may echo message content. */
class ProviderSendError extends Error {
  constructor(readonly status: number) {
    super(`Email provider returned HTTP ${status}`)
  }
}

/**
 * Lease one due row. Attempts are not incremented here: a database error while claiming or
 * rechecking must not use up one of the row's send attempts. Only a provider failure does.
 */
async function claimRow(): Promise<OutboxRow | null> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT "id" FROM "NotificationOutbox"
      WHERE ("status" = 'PENDING' AND "availableAt" <= CURRENT_TIMESTAMP)
        OR ("status" = 'PROCESSING' AND "lockedAt" < CURRENT_TIMESTAMP - INTERVAL '5 minutes')
      ORDER BY "availableAt" FOR UPDATE SKIP LOCKED LIMIT 1`
    if (!rows[0]) return null
    return tx.notificationOutbox.update({
      where: { id: rows[0].id },
      data: { status: 'PROCESSING', lockedAt: new Date() },
    })
  })
}

/**
 * Recheck under the writers' locks, then release them before the provider call so a slow
 * provider never stalls bookings. A change after this check queues its own notice.
 */
async function recheck(row: OutboxRow): Promise<boolean> {
  return prisma.$transaction(
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
}

async function deliver(
  row: OutboxRow,
  provider: { url: URL; token: string; from: string; redirect: string | undefined },
) {
  const { url, token, from, redirect } = provider
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': row.dedupeKey,
    },
    body: JSON.stringify({
      from,
      to: [redirect ?? row.to],
      subject: redirect ? `[to ${row.to}] ${row.subject}` : row.subject,
      text: row.text,
    }),
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new ProviderSendError(res.status)
  // Unconditional: the message went out even if a change canceled the row mid-send.
  await prisma.notificationOutbox.update({
    where: { id: row.id },
    data: { status: 'SENT', sentAt: new Date(), lockedAt: null, lastError: null },
  })
}

/** Counts the failed provider attempt, then retries with backoff or fails terminally. */
async function recordFailure(row: OutboxRow) {
  const attempt = row.attempts + 1
  await prisma.notificationOutbox.updateMany({
    where: { id: row.id, status: 'PROCESSING' },
    data: {
      status: attempt >= 5 ? 'FAILED' : 'PENDING',
      attempts: { increment: 1 },
      lockedAt: null,
      lastError: 'Email delivery failed; retrying with the same idempotency key.',
      availableAt: new Date(Date.now() + Math.min(60 * 60_000, 60_000 * 2 ** attempt)),
    },
  })
}

/** Error class and provider status only; messages can carry query text or recipient data. */
function failureCode(err: unknown): string {
  if (err instanceof ProviderSendError) return `http_${err.status}`
  return err instanceof Error ? err.name : 'unknown'
}

/** Resend-compatible HTTP adapter; never invoked by a page request. */
export async function processNotificationOutbox(
  limit = 10,
): Promise<{ sent: number; failed: number }> {
  const endpoint = process.env.EMAIL_PROVIDER_URL
  const token = process.env.EMAIL_PROVIDER_TOKEN
  const from = process.env.EMAIL_FROM
  const redirect = emailRedirect()
  if (!endpoint || !token || !from || redirect === null) return { sent: 0, failed: 0 }
  const url = new URL(endpoint)
  if (url.protocol !== 'https:' || url.username || url.password)
    throw new Error('EMAIL_PROVIDER_URL must use HTTPS')
  let sent = 0
  let failed = 0
  // Failed sends retry with the same provider idempotency key. Terminal failures stay inspectable.
  for (let i = 0; i < Math.min(Math.max(limit, 1), 50); i++) {
    let row: OutboxRow | null = null
    try {
      row = await claimRow()
    } catch (err) {
      logEvent('notification.claim_failed', { code: failureCode(err) })
      failed++
      break
    }
    if (!row) break
    try {
      if (!(await recheck(row))) continue
    } catch (err) {
      // Database trouble, not a provider failure: no attempt is consumed. The lease expires
      // and the row is picked up again.
      logEvent('notification.recheck_failed', { code: failureCode(err) })
      failed++
      continue
    }
    try {
      await deliver(row, { url, token, from, redirect })
      sent++
    } catch (err) {
      logEvent('notification.delivery_failed', { code: failureCode(err) })
      try {
        await recordFailure(row)
      } catch (recordErr) {
        logEvent('notification.record_failure_failed', { code: failureCode(recordErr) })
      }
      failed++
    }
  }
  return { sent, failed }
}
