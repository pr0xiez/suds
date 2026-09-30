import { buildMarketingContext, marketingBriefSchema } from '@/lib/ai/marketing'
import type { AiRun } from '@/lib/generated/prisma/client'
export async function validateMarketingReview(run: AiRun) {
  const request = run.request as unknown as { brief: unknown }
  const brief = marketingBriefSchema.parse(request.brief)
  const current = await buildMarketingContext(run.businessId, brief)
  const snapshot = run.output as unknown as { contextSnapshot?: { bookingUrl?: string } }
  if (snapshot?.contextSnapshot?.bookingUrl !== current.bookingUrl)
    throw new Error('Your booking link changed. Prepare a fresh draft before sharing.')
  if (brief.task === 'slots') {
    const output = run.output as unknown as { contextSnapshot?: { availability?: string[] } }
    if (
      JSON.stringify(output?.contextSnapshot?.availability) !== JSON.stringify(current.availability)
    )
      throw new Error('Availability changed. Prepare a fresh draft before sharing this campaign.')
  }
  return { checkedAt: new Date().toISOString(), bookingUrl: current.bookingUrl }
}
