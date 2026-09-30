import { processNotificationOutbox } from '@/lib/notifications'
import { logEvent } from '@/lib/observability'
import { processAiRuns } from './ai'

export async function runBackgroundWork() {
  const edits = await processAiRuns(1)
  const mail = await processNotificationOutbox(3)
  logEvent('worker_tick', { count: mail.sent + mail.failed })
  return { edits, mail }
}
