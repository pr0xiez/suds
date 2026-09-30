import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getBusinessSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { sameOriginOk } from '@/lib/http'
import { readMediaJson } from '@/lib/media/api'
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getBusinessSessionUser()
  if (!user) return NextResponse.json({ error: 'Sign in.' }, { status: 401 })
  if (user.businessRole !== 'OWNER' || !sameOriginOk(req))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  try {
    const input = z.object({ approved: z.boolean() }).parse(await readMediaJson(req))
    const updated = await prisma.photo.updateMany({
      where: { id: (await ctx.params).id, businessId: user.businessId },
      data: { approvedForMarketing: input.approved },
    })
    return updated.count
      ? NextResponse.json({ approved: input.approved })
      : NextResponse.json({ error: 'Photo not found.' }, { status: 404 })
  } catch {
    return NextResponse.json({ error: 'Invalid photo permission.' }, { status: 400 })
  }
}
