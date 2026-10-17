import { after } from 'next/server'
import { demoEnabled } from '@/lib/demo'
import { logEvent } from '@/lib/observability'
import { aiRunIsDue } from './lease'

/**
 * Wakes the worker as soon as the current response is sent, so queued work starts without
 * a polling schedule. Call it wherever work is queued or becomes due. A kick is only a
 * nudge: rows stay in the durable queues, and if a kick is lost the scheduled sweep picks
 * the work up. Outside a request (scripts, tests) it does nothing.
 */
export function kickWorker(): void {
  // The demo runs its own simulated worker and must never reach real delivery.
  if (demoEnabled()) return
  try {
    after(sendKick)
  } catch {
    // Not in a request scope.
  }
}

/** Kick when a run someone is waiting on could be claimed now, such as after a lost lease. */
export function kickIfAnyDue(
  runs: Array<{ status: string; nextAttemptAt: Date; lockedAt: Date | null }>,
) {
  const now = Date.now()
  if (runs.some((run) => aiRunIsDue(run, now))) kickWorker()
}

async function sendKick() {
  if (process.env.VERCEL !== '1') {
    // A long-lived server (local dev, self-hosted `next start`) drains in-process.
    try {
      const { drainBackgroundWork } = await import('@/lib/workers')
      await drainBackgroundWork()
    } catch {
      logEvent('worker_failed', { code: 'in_process_drain' })
    }
    return
  }
  try {
    // Vercel previews never ran background work (crons run in production only); keep it so.
    if (process.env.VERCEL_ENV !== 'production') return
    const secret = process.env.CRON_SECRET ?? ''
    if (secret.length < 32) {
      logEvent('worker_kick_skipped', { code: 'cron_secret_missing' })
      return
    }
    // The worker route acknowledges at once and drains under its own five-minute limit.
    const { publicAppUrl } = await import('@/lib/notifications')
    const headers: Record<string, string> = { Authorization: `Bearer ${secret}` }
    const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET
    if (bypass) headers['x-vercel-protection-bypass'] = bypass
    const response = await fetch(new URL('/api/internal/worker', publicAppUrl()), {
      method: 'POST',
      headers,
      cache: 'no-store',
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    })
    await response.body?.cancel()
    if (response.status !== 202) logEvent('worker_kick_failed', { code: String(response.status) })
  } catch {
    logEvent('worker_kick_failed', { code: 'unreachable' })
  }
}
