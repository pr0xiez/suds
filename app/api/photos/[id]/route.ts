import { type NextRequest, NextResponse } from 'next/server'
import { getBusinessSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { durableStorageConfigured, privateObjectUrl } from '@/lib/storage'
import { readUploadFile } from '@/lib/uploads'

/** Serves a photo's bytes from data/uploads/. Auth required — photos of
 * customers' cars are business data, not a public CDN. */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getBusinessSessionUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  const { id } = await ctx.params
  const photo = await prisma.photo.findFirst({ where: { id, businessId: user.businessId } })
  if (!photo) return new NextResponse('Not found', { status: 404 })

  if (durableStorageConfigured())
    return NextResponse.redirect(privateObjectUrl(photo.filename), {
      status: 307,
      headers: { 'Cache-Control': 'private, no-store' },
    })
  const data = await readUploadFile(photo.filename)
  if (!data) return new NextResponse('File missing on disk', { status: 404 })

  return new NextResponse(new Uint8Array(data), {
    headers: {
      'Content-Type': photo.contentType,
      'Content-Length': String(data.length),
      // The bytes for a given id never change — uploads get fresh ids.
      'Cache-Control': 'private, no-store',
    },
  })
}
