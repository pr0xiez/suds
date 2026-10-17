/** How long a worker holds a claimed AiRun before another worker may take it over. */
export const AI_LEASE_MS = 300_000

/** Whether a worker could claim this run right now, mirroring `claimRun` in ./ai. */
export function aiRunIsDue(
  run: { status: string; nextAttemptAt: Date; lockedAt: Date | null },
  now = Date.now(),
) {
  return (
    (run.status === 'QUEUED' || run.status === 'PROCESSING') &&
    run.nextAttemptAt.getTime() <= now &&
    (!run.lockedAt || run.lockedAt.getTime() < now - AI_LEASE_MS)
  )
}
