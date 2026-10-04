import { type NextRequest, NextResponse } from 'next/server'
import { validateMarketingReview } from '@/lib/ai/marketingReview'
import { getBusinessSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { userFacingError } from '@/lib/forms'
import { sameOriginOk } from '@/lib/http'
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getBusinessSessionUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })
  if (user.businessRole !== 'OWNER' || !sameOriginOk(req))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  const run = await prisma.aiRun.findFirst({
    where: {
      id: (await ctx.params).id,
      businessId: user.businessId,
      kind: 'MARKETING',
      status: 'COMPLETED',
    },
  })
  if (!run) return NextResponse.json({ error: 'Draft not found.' }, { status: 404 })
  try {
    return NextResponse.json(await validateMarketingReview(run), {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch (err) {
    return NextResponse.json(
      { error: userFacingError(err, 'Could not verify this draft.') },
      { status: 409 },
    )
  }
}
