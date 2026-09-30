import { describeVehicle, listServices, suggestCaption, withHashtags } from '@/lib/captions'
import { prisma } from '@/lib/db/client'
import type { Prisma, SocialPost } from '@/lib/generated/prisma/client'
import type { Platform } from '@/lib/generated/prisma/enums'
import { getSettings } from '@/lib/ops/settings'

export interface PostInput {
  caption: string
  platforms: Platform[]
  scheduledFor: Date | null
  jobId: string | null
  /** Ordered — the first photo is the cover. */
  photoIds: string[]
}

export const postInclude = {
  job: { include: { customer: true, vehicle: true, items: { orderBy: { sort: 'asc' } } } },
  photos: { include: { photo: true }, orderBy: { sort: 'asc' } },
} satisfies Prisma.SocialPostInclude

export type PostWithRelations = Prisma.SocialPostGetPayload<{ include: typeof postInclude }>

function photoRows(photoIds: string[]) {
  return photoIds.map((photoId, index) => ({ photoId, sort: index }))
}

async function validatePostReferences(businessId: string, input: PostInput) {
  if (input.jobId)
    await prisma.job.findUniqueOrThrow({
      where: { businessId_id: { businessId, id: input.jobId } },
    })
  if (new Set(input.photoIds).size !== input.photoIds.length)
    throw new Error('Photos must be distinct')
  const count = await prisma.photo.count({
    where: { businessId, id: { in: input.photoIds }, approvedForMarketing: true },
  })
  if (count !== input.photoIds.length) throw new Error('Unknown photo on post')
}

export async function createPost(businessId: string, input: PostInput): Promise<SocialPost> {
  await validatePostReferences(businessId, input)
  return prisma.socialPost.create({
    data: {
      businessId,
      caption: input.caption,
      platforms: input.platforms,
      scheduledFor: input.scheduledFor,
      jobId: input.jobId,
      photos: { create: photoRows(input.photoIds) },
    },
  })
}

export async function updatePost(
  businessId: string,
  id: string,
  input: PostInput,
): Promise<SocialPost> {
  await prisma.socialPost.findUniqueOrThrow({ where: { businessId_id: { businessId, id } } })
  await validatePostReferences(businessId, input)
  return prisma.$transaction(async (tx) => {
    await tx.postPhoto.deleteMany({ where: { postId: id } })
    return tx.socialPost.update({
      where: { businessId_id: { businessId, id } },
      data: {
        caption: input.caption,
        platforms: input.platforms,
        scheduledFor: input.scheduledFor,
        jobId: input.jobId,
        photos: { create: photoRows(input.photoIds) },
      },
    })
  })
}

export async function schedulePost(
  businessId: string,
  id: string,
  when: Date,
): Promise<SocialPost> {
  return prisma.socialPost.update({
    where: { businessId_id: { businessId, id } },
    data: { status: 'SCHEDULED', scheduledFor: when },
  })
}

/** The app doesn't publish to platform APIs — a person posts, then records it here. */
export async function markPosted(businessId: string, id: string): Promise<SocialPost> {
  return prisma.socialPost.update({
    where: { businessId_id: { businessId, id } },
    data: { status: 'POSTED', postedAt: new Date() },
  })
}

export async function revertToDraft(businessId: string, id: string): Promise<SocialPost> {
  return prisma.socialPost.update({
    where: { businessId_id: { businessId, id } },
    data: { status: 'DRAFT', postedAt: null },
  })
}

/** Photos stay in the library; only the post goes. */
export async function deletePost(businessId: string, id: string): Promise<void> {
  await prisma.socialPost.delete({ where: { businessId_id: { businessId, id } } })
}

interface CaptionJob {
  customer: { name: string }
  vehicle: { year: number | null; make: string; model: string; color: string }
  items: Array<{ name: string }>
}

/** The {{token}} values available to templates, from a job (or none) + settings. */
export function buildCaptionContext(
  job: CaptionJob | null,
  settings: { businessName: string; city: string; phone: string },
): Record<string, string> {
  const serviceNames = job?.items.map((item) => item.name) ?? []
  return {
    vehicle: job ? describeVehicle(job.vehicle) : '',
    vehicleShort: job ? `${job.vehicle.make} ${job.vehicle.model}` : '',
    services: listServices(serviceNames),
    service: serviceNames[0] ?? '',
    customer: '',
    business: settings.businessName,
    city: settings.city,
    phone: settings.phone,
  }
}

/**
 * The bridge between the two halves of the app: turn a finished job into a
 * draft post — after shots leading, before shots behind them, and a suggested
 * caption built from the job's vehicle and services plus the hashtag bank.
 */
export async function createPostFromJob(businessId: string, jobId: string): Promise<SocialPost> {
  const job = await prisma.job.findUniqueOrThrow({
    where: { businessId_id: { businessId, id: jobId } },
    include: {
      customer: true,
      vehicle: true,
      items: { orderBy: { sort: 'asc' } },
      photos: { where: { approvedForMarketing: true }, orderBy: { createdAt: 'asc' } },
    },
  })
  const settings = await getSettings(businessId)

  const kindOrder = { AFTER: 0, BEFORE: 1, OTHER: 2 } as const
  const photoIds = [...job.photos]
    .sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind])
    .map((photo) => photo.id)

  const context = buildCaptionContext(job, settings)
  const caption = withHashtags(suggestCaption(context), settings.hashtags)

  return createPost(businessId, {
    caption,
    platforms: ['INSTAGRAM', 'FACEBOOK'],
    scheduledFor: null,
    jobId,
    photoIds,
  })
}
