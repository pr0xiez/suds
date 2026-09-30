import { type NextRequest, NextResponse } from 'next/server'
import { getBusinessSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { privateObjectUrl } from '@/lib/storage'
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getBusinessSessionUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })
  if (user.businessRole !== 'OWNER') return new NextResponse('Forbidden', { status: 403 })
  const run = await prisma.aiRun.findFirst({
    where: {
      id: (await ctx.params).id,
      businessId: user.businessId,
      status: 'COMPLETED',
      kind: { in: ['VIDEO', 'PHOTOS'] },
    },
  })
  if (!run?.objectKey) return new NextResponse('Not found', { status: 404 })
  return NextResponse.redirect(privateObjectUrl(run.objectKey), {
    status: 307,
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
