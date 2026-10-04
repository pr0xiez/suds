import { revalidatePath } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'
import { getBusinessSessionUser } from '@/lib/auth/session'
import { userFacingError } from '@/lib/forms'
import { sameOriginOk } from '@/lib/http'
import { finalizeMediaUpload } from '@/lib/media/uploads'
export const runtime = 'nodejs'
export const maxDuration = 60
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getBusinessSessionUser()
  if (!user) return NextResponse.json({ error: 'Sign in to upload media.' }, { status: 401 })
  if (!sameOriginOk(req)) return NextResponse.json({ error: 'Bad origin.' }, { status: 403 })
  try {
    const result = await finalizeMediaUpload(user.businessId, user.id, (await ctx.params).id)
    revalidatePath('/', 'layout')
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (err) {
    return NextResponse.json(
      { error: userFacingError(err, 'Could not finalize the upload.') },
      { status: 400 },
    )
  }
}
