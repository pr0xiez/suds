import { prisma } from '@/lib/db/client'
import { processNotificationOutbox } from '@/lib/notifications'
import { logEvent } from '@/lib/observability'
import { processAiRuns } from './ai'
import { createDrainer } from './drain'
import { AI_LEASE_MS } from './lease'

export async function runBackgroundWork() {
  const edits = await processAiRuns(1)
  const mail = await processNotificationOutbox(3)
  // Every window writes a fresh key; closed windows are never read again.
  await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } })
  logEvent('worker_tick', { count: mail.sent + mail.failed })
  return { edits, mail }
}

/**
 * Earliest moment a tick could claim queued work: AI runs after their retry time and any
 * lease, pending email at its send time, and email whose sender stopped mid-delivery.
 * Mirrors the claim conditions in ./ai and processNotificationOutbox.
 */
export async function nextDueAt(): Promise<Date | null> {
  const lease = `${AI_LEASE_MS / 1000} seconds`
  const rows = await prisma.$queryRaw<Array<{ due: Date | null }>>`
    SELECT LEAST(
      (SELECT MIN(GREATEST("nextAttemptAt", COALESCE("lockedAt" + ${lease}::interval, "nextAttemptAt")))
         FROM "AiRun" WHERE "status" IN ('QUEUED','PROCESSING')),
      (SELECT MIN(CASE WHEN "status" = 'PENDING' THEN "availableAt" ELSE "lockedAt" + INTERVAL '5 minutes' END)
         FROM "NotificationOutbox"
         WHERE "status" = 'PENDING' OR ("status" = 'PROCESSING' AND "lockedAt" IS NOT NULL))
    ) AS "due"`
  const due = rows[0]?.due
  return due ? new Date(due) : null
}

const drainer = createDrainer({
  async tick() {
    const { edits, mail } = await runBackgroundWork()
    return { progressed: edits.processed + mail.sent + mail.failed > 0 }
  },
  nextDueAt,
})

/** Process everything due now and soon. Concurrent calls in one process share a drain. */
export const drainBackgroundWork = drainer.drain
