import { revalidatePath } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getBusinessSessionUser } from '@/lib/auth/session'
import { friendlyError } from '@/lib/forms'
import { declaredBodyWithin, sameOriginOk } from '@/lib/http'
import { addPhoto } from '@/lib/ops/photos'

const KINDS = ['BEFORE', 'AFTER', 'OTHER'] as const

/** Standalone library uploads — photos with no job attached. */
export async function POST(req: NextRequest) {
  const user = await getBusinessSessionUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url), 303)
  if (!sameOriginOk(req)) return new NextResponse('Bad origin', { status: 403 })

  const back = (suffix = '') => NextResponse.redirect(new URL(`/library${suffix}`, req.url), 303)

  if (process.env.NODE_ENV === 'production')
    return new NextResponse('Use the direct media uploader.', { status: 400 })
  if (!declaredBodyWithin(req, 20 * 1024 * 1024))
    return new NextResponse('Upload too large.', { status: 413 })
  const form = await req.formData()
  const kindParse = z.enum(KINDS).safeParse(form.get('kind'))
  const kind = kindParse.success ? kindParse.data : 'OTHER'
  const files = form.getAll('files').filter((entry): entry is File => entry instanceof File)
  const nonEmpty = files.filter((file) => file.size > 0)
  if (nonEmpty.length === 0) return back(`?error=${encodeURIComponent('Pick at least one image')}`)

  let added = 0
  let firstError: string | null = null
  for (const file of nonEmpty) {
    try {
      const data = Buffer.from(await file.arrayBuffer())
      await addPhoto(user.businessId, { jobId: null, kind, data, originalName: file.name })
      added += 1
    } catch (err) {
      firstError ??= `${file.name}: ${friendlyError(err)}`
    }
  }

  revalidatePath('/', 'layout')
  if (firstError && added === 0) return back(`?error=${encodeURIComponent(firstError)}`)
  if (firstError) return back(`?error=${encodeURIComponent(`Some uploads failed: ${firstError}`)}`)
  return back()
}
