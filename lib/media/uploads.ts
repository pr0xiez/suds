import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { readImageDimensions, sniffImageType } from '@/lib/images'
import { PILOT_STORAGE_BYTES, storedBusinessBytes } from '@/lib/media/usage'
import {
  acceptedMediaKey,
  deleteObject,
  directUploadUrl,
  durableStorageConfigured,
  mediaKey,
  objectHeader,
  promoteObject,
} from '@/lib/storage'
import { MAX_VIDEO_BYTES } from '@/lib/videoEditing'

export const uploadBriefSchema = z.object({
  kind: z.enum(['PHOTO', 'VIDEO']),
  originalName: z.string().trim().min(1).max(200),
  contentType: z.enum([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
  ]),
  sizeBytes: z.number().int().positive().max(MAX_VIDEO_BYTES),
  jobId: z.string().min(1).optional(),
  photoKind: z.enum(['BEFORE', 'AFTER', 'OTHER']).default('OTHER'),
  approvedForMarketing: z.boolean().default(false),
})
export function validateMediaHeader(
  kind: string,
  contentType: string,
  size: number,
  expectedSize: number,
  data: Buffer,
) {
  if (
    size !== expectedSize ||
    size <= 0 ||
    size > (kind === 'PHOTO' ? 10 * 1024 * 1024 : MAX_VIDEO_BYTES)
  )
    throw new Error('Uploaded file size does not match the approved upload.')
  if (kind === 'VIDEO') {
    if (
      !contentType.startsWith('video/') ||
      data.length < 12 ||
      data.toString('ascii', 4, 8) !== 'ftyp'
    )
      throw new Error('Choose a valid MP4 or MOV video.')
    return {
      ext: contentType === 'video/quicktime' ? 'mov' : 'mp4',
      contentType,
      width: null,
      height: null,
    }
  }
  const sniffed = sniffImageType(data)
  if (!sniffed || sniffed.contentType !== contentType)
    throw new Error('Choose a valid JPEG, PNG, WebP, or GIF photo.')
  const dims = readImageDimensions(data)
  if (!dims || dims.width < 1 || dims.height < 1 || dims.width * dims.height > 100_000_000)
    throw new Error('This image has unsupported dimensions.')
  return { ...sniffed, width: dims.width, height: dims.height }
}
export async function prepareMediaUpload(businessId: string, userId: string, input: unknown) {
  if (!durableStorageConfigured())
    throw new Error('Direct uploads require connected private media storage.')
  const brief = uploadBriefSchema.parse(input)
  if (
    (brief.kind === 'PHOTO' &&
      (!brief.contentType.startsWith('image/') || brief.sizeBytes > 10 * 1024 * 1024)) ||
    (brief.kind === 'VIDEO' && !brief.contentType.startsWith('video/'))
  )
    throw new Error('The file type or size is not supported.')
  if (
    brief.jobId &&
    !(await prisma.job.findFirst({ where: { id: brief.jobId, businessId }, select: { id: true } }))
  )
    throw new Error('Job not found.')
  const ext = (
    {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/gif': 'gif',
      'video/mp4': 'mp4',
      'video/quicktime': 'mov',
    } as const
  )[brief.contentType]
  const upload = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`media-upload:${businessId}`}))`
    const now = new Date()
    async function consume(key: string, amount: number, maximum: number, windowMs: number) {
      const existing = await tx.rateLimitBucket.findUnique({ where: { key } })
      const count = existing && existing.resetAt > now ? existing.count : 0
      if (count + amount > maximum)
        throw new Error('The business upload allowance has been reached. Try again later.')
      await tx.rateLimitBucket.upsert({
        where: { key },
        create: { key, count: amount, resetAt: new Date(now.getTime() + windowMs) },
        update: {
          count: count + amount,
          resetAt:
            existing && existing.resetAt > now
              ? existing.resetAt
              : new Date(now.getTime() + windowMs),
        },
      })
    }
    await consume(`uploads-hour:${businessId}`, 1, 60, 3600_000)
    await consume(`uploads-day-bytes:${businessId}`, brief.sizeBytes, 500 * 1024 * 1024, 86400_000)
    const stored = await storedBusinessBytes(tx, businessId)
    if (stored + brief.sizeBytes > PILOT_STORAGE_BYTES)
      throw new Error(
        'The 2 GB pilot storage allowance has been reached. Contact Suds for more space.',
      )
    return tx.mediaUpload.create({
      data: {
        ...brief,
        businessId,
        userId,
        objectKey: mediaKey(businessId, 'pending', ext),
        expiresAt: new Date(Date.now() + 15 * 60_000),
      },
    })
  })
  return {
    id: upload.id,
    ...directUploadUrl(upload.objectKey, upload.contentType, upload.sizeBytes),
  }
}
export async function finalizeMediaUpload(businessId: string, userId: string, id: string) {
  const upload = await prisma.mediaUpload.findFirst({ where: { id, businessId, userId } })
  if (!upload) throw new Error('Upload not found.')
  if (upload.status === 'READY') return { id: upload.id, kind: upload.kind, status: 'READY' }
  if (upload.expiresAt.getTime() < Date.now())
    throw new Error('This upload expired. Select the file again.')
  if (upload.status !== 'PENDING')
    throw new Error('This upload is being finalized or was rejected.')
  const claimed = await prisma.mediaUpload.updateMany({
    where: { id, businessId, userId, status: 'PENDING' },
    data: { status: 'FINALIZING' },
  })
  if (claimed.count !== 1) throw new Error('This upload is already being finalized.')
  let destination: string | null = null
  try {
    const source = await objectHeader(upload.objectKey)
    if (!source) throw new Error('Upload is incomplete. Try uploading the file again.')
    const valid = validateMediaHeader(
      upload.kind,
      upload.contentType,
      source.size,
      upload.sizeBytes,
      source.data,
    )
    destination = acceptedMediaKey(upload.objectKey)
    await promoteObject(upload.objectKey, destination, source.etag)
    // Recheck the immutable accepted copy, not the browser-writable staging key.
    const accepted = await objectHeader(destination)
    if (!accepted) throw new Error('Could not finalize the upload.')
    validateMediaHeader(
      upload.kind,
      upload.contentType,
      accepted.size,
      upload.sizeBytes,
      accepted.data,
    )
    const photo = await prisma.$transaction(async (tx) => {
      if (
        upload.jobId &&
        !(await tx.job.findFirst({ where: { id: upload.jobId, businessId }, select: { id: true } }))
      )
        throw new Error('Job is no longer available.')
      const photo =
        upload.kind === 'PHOTO'
          ? await tx.photo.create({
              data: {
                businessId,
                jobId: upload.jobId,
                kind: upload.photoKind ?? 'OTHER',
                filename: destination as string,
                originalName: upload.originalName,
                contentType: valid.contentType,
                bytes: accepted.size,
                width: valid.width,
                height: valid.height,
                approvedForMarketing: upload.approvedForMarketing,
              },
            })
          : null
      await tx.mediaUpload.update({
        where: { id },
        data: { status: 'READY', objectKey: destination as string },
      })
      return photo
    })
    await deleteObject(upload.objectKey).catch(() => undefined)
    return { id: upload.id, kind: upload.kind, status: 'READY', photoId: photo?.id }
  } catch (err) {
    const rejected = await prisma.mediaUpload.updateMany({
      where: { id, businessId, status: 'FINALIZING' },
      data: { status: 'REJECTED' },
    })
    // A commit whose acknowledgement was lost left the row READY and its media
    // record pointing at the accepted object: only a real rejection deletes it.
    if (rejected.count === 1) {
      if (destination) await deleteObject(destination).catch(() => undefined)
      await deleteObject(upload.objectKey).catch(() => undefined)
    }
    throw err
  }
}
