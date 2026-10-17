import {
  buildMarketingContext,
  generateMarketingDraft,
  marketingBriefSchema,
} from '@/lib/ai/marketing'
import { approvedPhotos, videoRunBrief } from '@/lib/ai/runs'
import { prisma } from '@/lib/db/client'
import { demoEnabled } from '@/lib/demo'
import { userFacingError } from '@/lib/forms'
import type { AiRun, Prisma } from '@/lib/generated/prisma/client'
import { PILOT_STORAGE_BYTES, StorageLimitError, storedBusinessBytes } from '@/lib/media/usage'
import { createPhotoShort, getPhotoShort } from '@/lib/ops/photoShorts'
import {
  acceptedMediaKey,
  deleteObject,
  mediaKey,
  privateObjectUrl,
  putObject,
} from '@/lib/storage'
import {
  createVideoEdit,
  getVideoEdit,
  MAX_VIDEO_BYTES,
  type VideoProject,
} from '@/lib/videoEditing'
import { AI_LEASE_MS as LEASE_MS } from './lease'

async function claimRun() {
  await prisma.aiRun.updateMany({
    where: {
      status: 'SUBMITTING',
      providerId: null,
      lockedAt: { lt: new Date(Date.now() - LEASE_MS) },
    },
    data: {
      status: 'UNCERTAIN',
      error:
        'Provider submission was interrupted. An administrator must reconcile provider usage before retrying.',
      lockedAt: null,
    },
  })
  const now = new Date()
  const rows = await prisma.$queryRaw<
    AiRun[]
  >`UPDATE "AiRun" SET "lockedAt"=${now}, "status"=CASE WHEN "status"='QUEUED' THEN 'SUBMITTING' ELSE "status" END, "attempts"="attempts"+1, "updatedAt"=${now} WHERE "id"=(SELECT "id" FROM "AiRun" WHERE "status" IN ('QUEUED','PROCESSING') AND "nextAttemptAt"<=${now} AND ("lockedAt" IS NULL OR "lockedAt"<${new Date(Date.now() - LEASE_MS)}) ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`
  return rows[0] ?? null
}
async function update(run: AiRun, data: Prisma.AiRunUpdateManyMutationInput) {
  const changed = await prisma.aiRun.updateMany({
    where: { id: run.id, businessId: run.businessId, lockedAt: run.lockedAt },
    data: { ...data, lockedAt: null },
  })
  if (changed.count !== 1) throw new Error('Worker lease was lost.')
}
/** HTTPS provider results only. Never fetch URLs from an owner-provided brief. */
export function approvedProviderUrl(value: string) {
  const url = new URL(value)
  const host = url.hostname.toLowerCase()
  const hosts = [
    'cdn.shotstack.io',
    'cdn.submagic.co',
    'cdn.submagic.io',
    'shotstack-api-v1-output.s3-ap-southeast-2.amazonaws.com',
    'shotstack-api-stage-output.s3-ap-southeast-2.amazonaws.com',
  ]
  const extra = (process.env.AI_MEDIA_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean)
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    (!hosts.includes(host) && !extra.includes(host))
  )
    throw new Error(
      'The provider returned an unsupported media host. Contact the Suds administrator.',
    )
  return url
}
async function downloadResult(value: string) {
  const url = approvedProviderUrl(value)
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(40_000),
    cache: 'no-store',
  })
  if (response.status >= 300 && response.status < 400) {
    await response.body?.cancel()
    throw new Error('Provider media redirects are not supported. Configure a direct output URL.')
  }
  if (!response.ok || !response.body)
    throw new Error('Could not save the completed video. The worker will retry downloading it.')
  if (Number(response.headers.get('content-length')) > MAX_VIDEO_BYTES) {
    await response.body.cancel()
    throw new Error('The edited video exceeds the 50 MB pilot download limit.')
  }
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.length
      if (size > MAX_VIDEO_BYTES) {
        await reader.cancel()
        throw new Error('The edited video exceeds the 50 MB pilot download limit.')
      }
      chunks.push(chunk.value)
    }
  } finally {
    reader.releaseLock()
  }
  const bytes = Buffer.concat(chunks)
  if (bytes.length < 12 || bytes.toString('ascii', 4, 8) !== 'ftyp')
    throw new Error('The provider result is not a valid MP4 video.')
  return bytes
}
async function activeOwner(run: AiRun) {
  return prisma.businessMembership.findFirst({
    where: {
      businessId: run.businessId,
      userId: run.userId,
      role: 'OWNER',
      active: true,
      acceptedAt: { not: null },
      user: { active: true, emailVerifiedAt: { not: null } },
    },
    select: { userId: true },
  })
}
async function processRun(run: AiRun) {
  let billable = false
  try {
    if (run.provider === 'demo' && !demoEnabled()) {
      await update(run, {
        status: 'FAILED',
        error: 'Demo runs require the isolated demo environment.',
      })
      return
    }
    if (!(await activeOwner(run))) {
      await update(run, {
        status: 'FAILED',
        error: 'The owner no longer has access to this business.',
      })
      return
    }
    if (run.kind === 'MARKETING') {
      const input = run.request as unknown as { brief: unknown }
      const brief = marketingBriefSchema.parse(input.brief)
      // Refresh actual business facts and consent just before provider execution.
      const context = await buildMarketingContext(run.businessId, brief)
      billable = true
      const output = await generateMarketingDraft(brief, context)
      await update(run, {
        status: 'COMPLETED',
        submittedAt: new Date(),
        output: output as Prisma.InputJsonValue,
        error: null,
      })
      return
    }
    const brief = videoRunBrief.parse(run.request)
    if (!run.providerId) {
      let project: VideoProject
      if (run.kind === 'PHOTOS') {
        const photos = await approvedPhotos(run.businessId, brief.photoIds)
        const urls = photos.map((photo) => privateObjectUrl(photo.filename, 3600))
        billable = true
        project = await createPhotoShort(brief.title, urls)
      } else {
        const upload = await prisma.mediaUpload.findFirst({
          where: {
            id: brief.uploadId,
            businessId: run.businessId,
            status: 'READY',
            kind: 'VIDEO',
            approvedForMarketing: true,
          },
        })
        if (!upload) throw new Error('The approved video is no longer available.')
        const url = privateObjectUrl(upload.objectKey, 3600)
        billable = true
        project = await createVideoEdit({ title: brief.title, style: brief.style, videoUrl: url })
      }
      await update(run, {
        providerId: project.id,
        status: project.status === 'failed' ? 'FAILED' : 'PROCESSING',
        submittedAt: new Date(),
        nextAttemptAt: new Date(Date.now() + 30_000),
        error: project.status === 'failed' ? 'The editor rejected this source.' : null,
      })
      return
    }
    const project =
      run.provider === 'shotstack'
        ? await getPhotoShort(run.providerId)
        : await getVideoEdit(run.providerId)
    if (project.status === 'failed') {
      await update(run, {
        status: 'FAILED',
        error: 'The editing provider could not finish this short.',
      })
      return
    }
    if (project.status !== 'completed' || !(project.directUrl || project.downloadUrl)) {
      await update(run, {
        status: 'PROCESSING',
        nextAttemptAt: new Date(Date.now() + 60_000),
        error: null,
      })
      return
    }
    const bytes = await downloadResult(project.downloadUrl ?? project.directUrl ?? '')
    const key = mediaKey(run.businessId, 'renders', 'mp4')
    // Reserve bytes and persist the object pointer before upload, making crashes recoverable.
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`media-upload:${run.businessId}`}))`
      if (
        (await storedBusinessBytes(tx, run.businessId, run.id)) + bytes.length >
        PILOT_STORAGE_BYTES
      )
        throw new StorageLimitError(
          'The 2 GB pilot storage allowance has been reached. Delete unused media before resuming this edit.',
        )
      const reserved = await tx.aiRun.updateMany({
        where: { id: run.id, businessId: run.businessId, lockedAt: run.lockedAt },
        data: { objectKey: key, output: { title: brief.title, bytes: bytes.length } },
      })
      if (reserved.count !== 1) throw new Error('Worker lease was lost.')
    })
    if (run.objectKey && run.objectKey !== key)
      await deleteObject(run.objectKey).catch(() => undefined)
    await putObject(key, bytes, 'video/mp4')
    try {
      await update(run, {
        status: 'COMPLETED',
        objectKey: key,
        output: { title: brief.title, bytes: bytes.length },
        error: null,
      })
    } catch (err) {
      await deleteObject(key).catch(() => undefined)
      throw err
    }
  } catch (err) {
    // No paid retry after any uncertain submit/receipt. Only read/status/download retries.
    const uncertain = billable && !run.providerId
    const retry =
      Boolean(run.providerId) &&
      !(err instanceof StorageLimitError) &&
      run.attempts < 30 &&
      run.createdAt.getTime() > Date.now() - 2 * 86400_000
    const error = userFacingError(err, 'The AI request could not be completed.')
    await update(run, {
      status: uncertain ? 'UNCERTAIN' : retry ? 'PROCESSING' : 'FAILED',
      error: error.slice(0, 500),
      nextAttemptAt: new Date(
        Date.now() + Math.min(600_000, 30_000 * 2 ** Math.min(run.attempts, 4)),
      ),
    }).catch(() => undefined)
  }
}
export async function cleanupExpiredUploads(limit = 20) {
  const uploads = await prisma.mediaUpload.findMany({
    where: {
      status: { in: ['PENDING', 'REJECTED', 'FINALIZING', 'DELETING'] },
      expiresAt: { lt: new Date(Date.now() - 3600_000) },
    },
    take: limit,
  })
  let removed = 0
  for (const upload of uploads) {
    try {
      await deleteObject(upload.objectKey)
      if (upload.objectKey.startsWith('pending/') || upload.objectKey.includes('/pending/'))
        await deleteObject(acceptedMediaKey(upload.objectKey))
      await prisma.mediaUpload.deleteMany({ where: { id: upload.id, status: upload.status } })
      removed++
    } catch {
      /* The next sweep retries cleanup. */
    }
  }
  return removed
}
export async function processAiRuns(limit = 3) {
  let processed = 0
  for (let i = 0; i < Math.min(Math.max(limit, 0), 10); i++) {
    const run = await claimRun()
    if (!run) break
    await processRun(run)
    processed++
  }
  return { processed, expiredUploadsRemoved: await cleanupExpiredUploads() }
}
