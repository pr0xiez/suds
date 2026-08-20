/**
 * In-memory, per-process rate limit for login attempts. Resets on restart and
 * doesn't coordinate across instances — fine for a single-instance internal
 * tool; swap for something durable before deploying anywhere serverless.
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function allowAttempt(
  key: string,
  max = 10,
  windowMs = 15 * 60 * 1000,
  now = Date.now(),
): boolean {
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  bucket.count += 1
  return bucket.count <= max
}

export function resetAttempts(key: string): void {
  buckets.delete(key)
}
