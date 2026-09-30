import { type NextRequest, NextResponse } from 'next/server'
import { getBusinessSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { sameOriginOk } from '@/lib/http'
import { deleteObject } from '@/lib/storage'
export const maxDuration = 60
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getBusinessSessionUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })
  if (user.businessRole !== 'OWNER' || !sameOriginOk(req))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  try {
    const id = (await ctx.params).id
    const upload = await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`media-upload:${user.businessId}`}))`
        const upload = await tx.mediaUpload.findFirst({
          where: {
            id,
            businessId: user.businessId,
            kind: 'VIDEO',
            status: { in: ['READY', 'DELETING'] },
          },
        })
        if (!upload) throw new Error('Video source not found.')
        const active = await tx.aiRun.count({
          where: {
            businessId: user.businessId,
            kind: 'VIDEO',
            status: { in: ['QUEUED', 'SUBMITTING', 'PROCESSING', 'UNCERTAIN'] },
            request: { path: ['uploadId'], equals: id },
          },
        })
        if (active)
          throw new Error(
            'An active or uncertain edit uses this source. Finish or reconcile that edit before deleting it.',
          )
        await tx.mediaUpload.updateMany({
          where: { id, businessId: user.businessId },
          data: { status: 'DELETING', expiresAt: new Date() },
        })
        return upload
      },
      { timeout: 20_000 },
    )
    await deleteObject(upload.objectKey)
    await prisma.mediaUpload.deleteMany({
      where: { id: upload.id, businessId: user.businessId, status: 'DELETING' },
    })
    return NextResponse.json({ deleted: true })
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : 'Could not delete the source. Cleanup will retry.',
      },
      { status: 409 },
    )
  }
}
