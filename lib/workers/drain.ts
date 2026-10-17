/**
 * Runs background ticks until nothing is due within the time budget, then stops so the
 * database can scale to zero. Work queued later arrives with its own kick; work due after
 * the budget (reminders, long retry backoff) is picked up by the scheduled sweep.
 */

/** Leaves headroom under the worker route's five-minute maxDuration for one slow tick. */
export const DRAIN_BUDGET_MS = 240_000
/** Due work that a tick could not claim (held elsewhere, provider not configured) gets one short retry. */
const IDLE_RETRY_MS = 2_000
const MAX_TICKS = 200

export interface DrainDeps {
  tick: () => Promise<{ progressed: boolean }>
  /** Earliest moment any queued work becomes claimable, or null when the queues are empty. */
  nextDueAt: () => Promise<Date | null>
  now?: () => number
  wait?: (ms: number, signal: AbortSignal) => Promise<void>
}

export interface DrainResult {
  ticks: number
  productiveTicks: number
  nextDueAt: string | null
}

function interruptibleWait(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve()
    const timer = setTimeout(done, ms)
    function done() {
      clearTimeout(timer)
      signal.removeEventListener('abort', done)
      resolve()
    }
    signal.addEventListener('abort', done, { once: true })
  })
}

export function createDrainer(deps: DrainDeps) {
  const now = deps.now ?? Date.now
  const wait = deps.wait ?? interruptibleWait
  let active: Promise<DrainResult> | null = null
  let requested = false
  let interrupt: AbortController | null = null

  async function loop(budgetMs: number): Promise<DrainResult> {
    // Yield first so `drain` records this run as active before anything can settle it.
    await Promise.resolve()
    const deadline = now() + budgetMs
    let ticks = 0
    let productiveTicks = 0
    let idleRetries = 0
    let overtime = 0
    let due: Date | null = null
    try {
      while (true) {
        requested = false
        const result = await deps.tick()
        ticks++
        if (result.progressed) {
          productiveTicks++
          idleRetries = 0
        }
        due = await deps.nextDueAt()
        let delay: number | null = null
        if (requested) delay = 0
        else if (due) {
          const until = due.getTime() - now()
          if (until > 0) delay = until
          else if (result.progressed) delay = 0
          else if (idleRetries++ < 1) delay = IDLE_RETRY_MS
        }
        const withinBudget = delay !== null && now() + delay <= deadline && ticks < MAX_TICKS
        if (!withinBudget) {
          // A kick that landed during the last tick still gets one tick of its own.
          if (requested && overtime++ < 1) continue
          return { ticks, productiveTicks, nextDueAt: due?.toISOString() ?? null }
        }
        if (delay && delay > 0) {
          interrupt = new AbortController()
          await wait(delay, interrupt.signal)
          interrupt = null
        }
      }
    } finally {
      // Cleared synchronously with the final check, so a later kick starts a fresh drain.
      active = null
      interrupt = null
    }
  }

  /** Starts a drain, or wakes the one already running in this process and shares its result. */
  function drain(budgetMs = DRAIN_BUDGET_MS): Promise<DrainResult> {
    if (active) {
      requested = true
      interrupt?.abort()
      return active
    }
    active = loop(budgetMs)
    return active
  }

  return { drain }
}
