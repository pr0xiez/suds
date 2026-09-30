import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { validateMarketingReview } from '@/lib/ai/marketingReview'
import { getBusinessSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import type { Prisma } from '@/lib/generated/prisma/client'
import { sameOriginOk } from '@/lib/http'
import { readMediaJson } from '@/lib/media/api'
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getBusinessSessionUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })
  if (user.businessRole !== 'OWNER' || !sameOriginOk(req))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  try {
    const edit = z
      .object({ caption: z.string().trim().min(1).max(2200) })
      .parse(await readMediaJson(req))
    const run = await prisma.aiRun.findFirst({
      where: {
        id: (await ctx.params).id,
        businessId: user.businessId,
        kind: 'MARKETING',
        status: 'COMPLETED',
      },
    })
    if (!run) return NextResponse.json({ error: 'Draft not found.' }, { status: 404 })
    await validateMarketingReview(run)
    const previous =
      run.output && typeof run.output === 'object' && !Array.isArray(run.output) ? run.output : {}
    await prisma.aiRun.updateMany({
      where: { id: run.id, businessId: user.businessId },
      data: {
        output: {
          ...previous,
          caption: edit.caption,
          editedAt: new Date().toISOString(),
        } as Prisma.InputJsonValue,
      },
    })
    return NextResponse.json({ saved: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not save this caption.' },
      { status: 400 },
    )
  }
}
