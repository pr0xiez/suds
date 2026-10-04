import { prisma } from '@/lib/db/client'
import { processNotificationOutbox } from '@/lib/notifications'
import { logEvent } from '@/lib/observability'
import { processAiRuns } from './ai'

export async function runBackgroundWork() {
  const edits = await processAiRuns(1)
  const mail = await processNotificationOutbox(3)
  // Every window writes a fresh key; closed windows are never read again.
  await prisma.rateLimitBucket.deleteMany({ where: { resetAt: { lt: new Date() } } })
  logEvent('worker_tick', { count: mail.sent + mail.failed })
  return { edits, mail }
}
