import { prisma } from '@/lib/db/client'
import { collectedSql } from '@/lib/revenue'

/** Paid job count and collected cents since `since`, aggregated in the database. */
export async function collectedSince(
  businessId: string,
  since: Date,
): Promise<{ count: number; cents: number }> {
  const rows = await prisma.$queryRawUnsafe<Array<{ count: number; cents: bigint }>>(
    `SELECT COUNT(*)::int AS count, COALESCE(SUM(${collectedSql}), 0)::bigint AS cents
     FROM "Job" j WHERE j."businessId" = $1 AND j."paidAt" >= $2`,
    businessId,
    since,
  )
  const row = rows[0]
  return { count: row?.count ?? 0, cents: Number(row?.cents ?? 0) }
}
