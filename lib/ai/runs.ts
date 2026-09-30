import { z } from 'zod'
import {
  buildMarketingContext,
  marketingBriefSchema,
  marketingConfigured,
} from '@/lib/ai/marketing'
import { prisma } from '@/lib/db/client'
import { demoEnabled } from '@/lib/demo'
import type { AiRun, Prisma } from '@/lib/generated/prisma/client'
import { photoShortsConfigured } from '@/lib/ops/photoShorts'
import { durableStorageConfigured, privateObjectUrl } from '@/lib/storage'
import { VIDEO_STYLES, videoEditingConfigured } from '@/lib/videoEditing'
export const videoRunBrief = z.object({
  mode: z.enum(['video', 'photos']),
  title: z.string().trim().min(1).max(100),
  style: z.enum(VIDEO_STYLES).default('kelly'),
  uploadId: z.string().min(1).optional(),
  photoIds: z.array(z.string().min(1)).max(8).default([]),
  approved: z.literal(true),
  idempotencyKey: z.string().uuid(),
})
export class UsageLimitError extends Error {}
export function withinUsageLimit(hourly: number, daily: number, kind: string) {
  return hourly < (kind === 'MARKETING' ? 10 : 3) && daily < (kind === 'MARKETING' ? 30 : 10)
}
async function enqueue(
  businessId: string,
  userId: string,
  kind: string,
  provider: string,
  request: Prisma.InputJsonValue,
  idempotencyKey: string,
) {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ai-quota:${businessId}`}))`
      if (kind === 'VIDEO') {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`media-upload:${businessId}`}))`
        const brief = videoRunBrief.parse(request)
        if (
          !(await tx.mediaUpload.findFirst({
            where: {
              id: brief.uploadId,
              businessId,
              status: 'READY',
              kind: 'VIDEO',
              approvedForMarketing: true,
            },
            select: { id: true },
          }))
        )
          throw new Error('The approved source video is no longer available.')
      }
      const existing = await tx.aiRun.findUnique({
        where: { businessId_idempotencyKey: { businessId, idempotencyKey } },
      })
      if (existing) {
        if (existing.userId !== userId || existing.kind !== kind)
          throw new Error('This request key is already in use.')
        return existing
      }
      const grouping = kind === 'MARKETING' ? ['MARKETING'] : ['VIDEO', 'PHOTOS']
      const hourly = await tx.aiRun.count({
        where: {
          businessId,
          kind: { in: grouping },
          createdAt: { gte: new Date(Date.now() - 3600_000) },
        },
      })
      const daily = await tx.aiRun.count({
        where: {
          businessId,
          kind: { in: grouping },
          createdAt: { gte: new Date(Date.now() - 86400_000) },
        },
      })
      if (!withinUsageLimit(hourly, daily, kind))
        throw new UsageLimitError('The business AI allowance has been reached. Try again later.')
      return tx.aiRun.create({
        data: { businessId, userId, kind, provider, request, idempotencyKey },
      })
    },
    { timeout: 20_000 },
  )
}
export async function enqueueMarketing(businessId: string, userId: string, input: unknown) {
  if (!marketingConfigured()) throw new Error('The Suds marketing assistant is not connected yet.')
  const parsed = z.object({ idempotencyKey: z.string().uuid() }).passthrough().parse(input)
  const brief = marketingBriefSchema.parse(parsed)
  const context = await buildMarketingContext(businessId, brief)
  return enqueue(
    businessId,
    userId,
    'MARKETING',
    demoEnabled() ? 'demo' : 'openai',
    { brief, context } as unknown as Prisma.InputJsonValue,
    parsed.idempotencyKey,
  )
}
export async function approvedPhotos(businessId: string, ids: string[]) {
  if (ids.length < 2 || ids.length > 8 || new Set(ids).size !== ids.length)
    throw new Error('Choose 2–8 different approved photos.')
  const photos = await prisma.photo.findMany({
    where: { businessId, id: { in: ids }, approvedForMarketing: true },
  })
  if (photos.length !== ids.length)
    throw new Error('Approve all selected photos for marketing in the library first.')
  return ids.map((id) => {
    const photo = photos.find((photo) => photo.id === id)
    if (!photo) throw new Error('Photo no longer available.')
    return photo
  })
}
export async function enqueueVideo(businessId: string, userId: string, input: unknown) {
  const brief = videoRunBrief.parse(input)
  if (
    !durableStorageConfigured() ||
    !(brief.mode === 'photos' ? photoShortsConfigured() : videoEditingConfigured())
  )
    throw new Error('This editing connection or private media storage has not been enabled yet.')
  if (brief.mode === 'photos') await approvedPhotos(businessId, brief.photoIds)
  else {
    if (!brief.uploadId) throw new Error('Upload a video first.')
    const upload = await prisma.mediaUpload.findFirst({
      where: {
        id: brief.uploadId,
        businessId,
        status: 'READY',
        kind: 'VIDEO',
        approvedForMarketing: true,
      },
    })
    if (!upload) throw new Error('Choose your approved, finalized video from this business.')
  }
  return enqueue(
    businessId,
    userId,
    brief.mode === 'photos' ? 'PHOTOS' : 'VIDEO',
    brief.mode === 'photos' ? 'shotstack' : 'submagic',
    brief,
    brief.idempotencyKey,
  )
}
export function presentRun(run: AiRun) {
  const output =
    run.output && typeof run.output === 'object' && !Array.isArray(run.output) ? run.output : {}
  const title =
    typeof output.title === 'string'
      ? output.title
      : run.request &&
          typeof run.request === 'object' &&
          !Array.isArray(run.request) &&
          typeof run.request.title === 'string'
        ? run.request.title
        : 'Your short'
  return {
    id: run.id,
    kind: run.kind,
    status: run.status,
    error: run.error,
    output,
    createdAt: run.createdAt.toISOString(),
    project: {
      id: run.id,
      title,
      status:
        run.status === 'COMPLETED'
          ? 'completed'
          : run.status === 'FAILED' || run.status === 'UNCERTAIN'
            ? 'failed'
            : 'processing',
      directUrl:
        run.objectKey && run.status === 'COMPLETED' ? privateObjectUrl(run.objectKey) : undefined,
      downloadUrl:
        run.objectKey && run.status === 'COMPLETED' ? `/api/ai-runs/${run.id}/download` : undefined,
    },
  }
}
