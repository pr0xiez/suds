import { type NextRequest, NextResponse } from 'next/server'
import { getBusinessSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { sameOriginOk } from '@/lib/http'
import { kickWorker } from '@/lib/workers/kick'
/** A known provider receipt resumes only status/download; this never submits another paid edit. */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getBusinessSessionUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })
  if (user.businessRole !== 'OWNER' || !sameOriginOk(req))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const changed = await prisma.aiRun.updateMany({
    where: {
      id: (await ctx.params).id,
      businessId: user.businessId,
      kind: { in: ['VIDEO', 'PHOTOS'] },
      status: 'FAILED',
      providerId: { not: null },
    },
    data: {
      status: 'PROCESSING',
      attempts: 0,
      error: null,
      lockedAt: null,
      nextAttemptAt: new Date(),
    },
  })
  if (changed.count) kickWorker()
  return changed.count
    ? NextResponse.json({ resumed: true })
    : NextResponse.json(
        {
          error:
            'Only an edit with a saved provider receipt can be resumed. Contact the Suds administrator for an uncertain submission.',
        },
        { status: 409 },
      )
}
