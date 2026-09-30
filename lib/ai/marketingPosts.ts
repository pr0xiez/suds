import { z } from 'zod'
import { marketingBriefSchema } from '@/lib/ai/marketing'
import { validateMarketingReview } from '@/lib/ai/marketingReview'
import { CAPTION_MAX } from '@/lib/captions'
import { prisma } from '@/lib/db/client'
import type { PostInput } from '@/lib/ops/social'
/** Explicit owner action, after a completed draft. The normal composer saves the post. */
export async function loadMarketingPostBrief(
  businessId: string,
  runId: string,
): Promise<PostInput> {
  const run = await prisma.aiRun.findFirst({
    where: { id: runId, businessId, kind: 'MARKETING', status: 'COMPLETED' },
  })
  if (!run) throw new Error('Marketing draft not found.')
  await validateMarketingReview(run)
  const request = run.request as unknown as { brief: unknown }
  const brief = marketingBriefSchema.parse(request.brief)
  const output = z
    .object({
      caption: z.string().min(1).max(CAPTION_MAX),
      hashtags: z.array(z.string().max(60)).max(10).optional(),
    })
    .parse(run.output)
  const withTags = [output.caption, output.hashtags?.join(' ') ?? ''].filter(Boolean).join('\n\n')
  if (withTags.length > CAPTION_MAX)
    throw new Error(
      `Shorten the caption to leave room for hashtags (maximum ${CAPTION_MAX} characters).`,
    )
  return {
    caption: withTags,
    platforms: [brief.platform],
    scheduledFor: null,
    jobId: brief.jobId ?? null,
    photoIds: brief.photoIds,
  }
}
