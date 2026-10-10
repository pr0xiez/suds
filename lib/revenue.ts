import { jobTotalCents } from '@/lib/money'

/**
 * Collected revenue for one paid job: line items minus discount (never below
 * zero) plus tip. `collectedSql` below must express the same rule; the test in
 * revenue.test.ts pins both so they cannot drift. Pure: no database import.
 */
export function jobCollectedCents(job: {
  items: Array<{ priceCents: number }>
  discountCents: number
  tipCents: number
}): number {
  return jobTotalCents(job) + job.tipCents
}

/** SQL twin of jobCollectedCents for a "Job" row aliased `j`. Integer cents. */
export const collectedSql =
  'GREATEST(0, COALESCE((SELECT SUM(i."priceCents") FROM "JobItem" i WHERE i."jobId" = j."id"), 0) - j."discountCents") + j."tipCents"'
