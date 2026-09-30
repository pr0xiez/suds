import { createHash } from 'node:crypto'
import { prisma } from '@/lib/db/client'

/** Atomic, shared fixed-window limit. Keys are hashed to avoid storing email/IP text. */
export async function consumeRateLimit(
  key: string,
  max = 10,
  windowMs = 15 * 60_000,
  now = Date.now(),
): Promise<boolean> {
  const start = Math.floor(now / windowMs) * windowMs
  const bucketKey = createHash('sha256').update(`${key}:${start}`).digest('hex')
  const resetAt = new Date(start + windowMs)
  const rows = await prisma.$queryRaw<Array<{ count: number }>>`
    INSERT INTO "RateLimitBucket" ("key", "count", "resetAt") VALUES (${bucketKey}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET "count" = "RateLimitBucket"."count" + 1
    RETURNING "count"`
  return (rows[0]?.count ?? max + 1) <= max
}
