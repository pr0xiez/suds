import { type NextRequest, NextResponse } from 'next/server'
import { enqueueMarketing, presentRun, UsageLimitError } from '@/lib/ai/runs'
import { getBusinessSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { sameOriginOk } from '@/lib/http'
import { readMediaJson } from '@/lib/media/api'
export const runtime = 'nodejs'
const json = (data: unknown, status = 200) =>
  NextResponse.json(data, { status, headers: { 'Cache-Control': 'private, no-store' } })
export async function POST(req: NextRequest) {
  const user = await getBusinessSessionUser()
  if (!user) return json({ error: 'Sign in.' }, 401)
  if (user.businessRole !== 'OWNER')
    return json({ error: 'Only the owner can invoke the marketing assistant.' }, 403)
  if (!sameOriginOk(req)) return json({ error: 'Bad origin.' }, 403)
  if (Number(req.headers.get('content-length')) > 16384)
    return json({ error: 'Brief is too large.' }, 413)
  try {
    return json(
      presentRun(await enqueueMarketing(user.businessId, user.id, await readMediaJson(req))),
      201,
    )
  } catch (err) {
    return json(
      { error: err instanceof Error ? err.message : 'Could not queue the draft.' },
      err instanceof UsageLimitError ? 429 : 400,
    )
  }
}
export async function GET(req: NextRequest) {
  const user = await getBusinessSessionUser()
  if (!user) return json({ error: 'Sign in.' }, 401)
  if (user.businessRole !== 'OWNER')
    return json({ error: 'Only the owner can read assistant drafts.' }, 403)
  const id = req.nextUrl.searchParams.get('id')
  const runs = await prisma.aiRun.findMany({
    where: { businessId: user.businessId, kind: 'MARKETING', ...(id ? { id } : {}) },
    orderBy: { createdAt: 'desc' },
    take: id ? 1 : 20,
  })
  return id
    ? runs[0]
      ? json(presentRun(runs[0]))
      : json({ error: 'Draft not found.' }, 404)
    : json({ runs: runs.map(presentRun) })
}
