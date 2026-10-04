import { type NextRequest, NextResponse } from 'next/server'
import { getBusinessSessionUser } from '@/lib/auth/session'
import { userFacingError } from '@/lib/forms'
import { sameOriginOk } from '@/lib/http'
import { readMediaJson } from '@/lib/media/api'
import { prepareMediaUpload } from '@/lib/media/uploads'
export const runtime = 'nodejs'
export async function POST(req: NextRequest) {
  const user = await getBusinessSessionUser()
  if (!user) return NextResponse.json({ error: 'Sign in to upload media.' }, { status: 401 })
  if (!sameOriginOk(req)) return NextResponse.json({ error: 'Bad origin.' }, { status: 403 })
  if (Number(req.headers.get('content-length')) > 16384)
    return NextResponse.json({ error: 'Upload request is too large.' }, { status: 413 })
  try {
    const raw = await readMediaJson(req)
    if (!raw || typeof raw !== 'object' || Array.isArray(raw))
      throw new Error('Invalid upload request.')
    const input = raw as Record<string, unknown>
    if (input.kind === 'VIDEO' && user.businessRole !== 'OWNER')
      return NextResponse.json(
        { error: 'Only the owner can upload a video for editing.' },
        { status: 403 },
      )
    return NextResponse.json(
      await prepareMediaUpload(user.businessId, user.id, {
        ...input,
        ...(user.businessRole !== 'OWNER' ? { approvedForMarketing: false } : {}),
      }),
      {
        status: 201,
        headers: { 'Cache-Control': 'private, no-store' },
      },
    )
  } catch (err) {
    return NextResponse.json(
      { error: userFacingError(err, 'Could not prepare the upload.') },
      { status: 400 },
    )
  }
}
export async function GET() {
  const user = await getBusinessSessionUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })
  if (user.businessRole !== 'OWNER')
    return NextResponse.json({ error: 'Only the owner can manage video sources.' }, { status: 403 })
  const { prisma } = await import('@/lib/db/client')
  const uploads = await prisma.mediaUpload.findMany({
    where: { businessId: user.businessId, kind: 'VIDEO', status: { in: ['READY', 'DELETING'] } },
    select: { id: true, originalName: true, sizeBytes: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({ uploads }, { headers: { 'Cache-Control': 'private, no-store' } })
}
