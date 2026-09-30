import { type NextRequest, NextResponse } from 'next/server'
import { enqueueVideo, presentRun, UsageLimitError } from '@/lib/ai/runs'
import { getBusinessSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { sameOriginOk } from '@/lib/http'
import { readMediaJson } from '@/lib/media/api'
export const runtime = 'nodejs'
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
export async function POST(req: NextRequest) {
  const user = await getBusinessSessionUser()
  if (!user) return json({ error: 'Sign in to edit a video.' }, 401)
  if (user.businessRole !== 'OWNER')
    return json({ error: 'Only the business owner can start an AI edit.' }, 403)
  if (!sameOriginOk(req)) return json({ error: 'Bad origin.' }, 403)
  if (Number(req.headers.get('content-length')) > 16384)
    return json({ error: 'The edit brief is too large.' }, 413)
  try {
    return json(
      presentRun(await enqueueVideo(user.businessId, user.id, await readMediaJson(req))),
      201,
    )
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Could not queue the edit.' },
      err instanceof UsageLimitError ? 429 : 400,
    )
  }
}
export async function GET(req: NextRequest) {
  const user = await getBusinessSessionUser()
  if (!user) return json({ error: 'Sign in to check your edit.' }, 401)
  if (user.businessRole !== 'OWNER')
    return json({ error: 'Only the owner can access AI edits.' }, 403)
  const id = req.nextUrl.searchParams.get('id')
  if (id) {
    const run = await prisma.aiRun.findFirst({
      where: { id, businessId: user.businessId, kind: { in: ['VIDEO', 'PHOTOS'] } },
    })
    return run ? json(presentRun(run)) : json({ error: 'Edit not found.' }, 404)
  }
  const runs = await prisma.aiRun.findMany({
    where: { businessId: user.businessId, kind: { in: ['VIDEO', 'PHOTOS'] } },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })
  return json({ runs: runs.map(presentRun) })
}
