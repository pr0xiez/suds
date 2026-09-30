import { revalidatePath } from 'next/cache'
import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getBusinessSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { friendlyError } from '@/lib/forms'
import { sameOriginOk } from '@/lib/http'
import { addPhoto } from '@/lib/ops/photos'

const KINDS = ['BEFORE', 'AFTER', 'OTHER'] as const

/** Multipart upload of one or more photos onto a job (plain form post). */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getBusinessSessionUser()
  if (!user) return NextResponse.redirect(new URL('/login', req.url), 303)
  if (!sameOriginOk(req)) return new NextResponse('Bad origin', { status: 403 })

  const { id } = await ctx.params
  const back = (suffix = '') => NextResponse.redirect(new URL(`/jobs/${id}${suffix}`, req.url), 303)

  const job = await prisma.job.findFirst({
    where: { id, businessId: user.businessId },
    select: { id: true },
  })
  if (!job) return new NextResponse('Job not found', { status: 404 })

  if (process.env.NODE_ENV === 'production')
    return new NextResponse('Use the direct media uploader.', { status: 400 })
  if (Number(req.headers.get('content-length')) > 20 * 1024 * 1024)
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
      await addPhoto(user.businessId, { jobId: id, kind, data, originalName: file.name })
      added += 1
    } catch (err) {
      firstError ??= `${file.name}: ${friendlyError(err)}`
    }
  }

  revalidatePath('/', 'layout')
  if (firstError && added === 0) return back(`?error=${encodeURIComponent(firstError)}`)
  if (firstError) return back(`?error=${encodeURIComponent(`Some uploads failed — ${firstError}`)}`)
  return back()
}
