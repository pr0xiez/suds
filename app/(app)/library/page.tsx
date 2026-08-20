import clsx from 'clsx'
import Link from 'next/link'
import { ErrorBanner } from '@/components/banners'
import { PhotoTile } from '@/components/PhotoTile'
import { btnSecondary, Card, EmptyState, PageHeader, selectClass } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import type { Prisma } from '@/lib/generated/prisma/client'

export const metadata = { title: 'Library' }

const KINDS = ['ALL', 'AFTER', 'BEFORE', 'OTHER'] as const
type KindFilter = (typeof KINDS)[number]

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; error?: string }>
}) {
  await requireUser()
  const params = await searchParams
  const kind: KindFilter = KINDS.includes(params.kind as KindFilter)
    ? (params.kind as KindFilter)
    : 'ALL'

  const where: Prisma.PhotoWhereInput = kind === 'ALL' ? {} : { kind }
  const photos = await prisma.photo.findMany({
    where,
    include: { job: { include: { vehicle: true, customer: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })

  const back = kind === 'ALL' ? '/library' : `/library?kind=${kind}`

  return (
    <div>
      <PageHeader
        title="Library"
        subtitle="Every photo in one place — job shots and standalone uploads"
      />
      <ErrorBanner message={params.error} />

      <Card className="mb-4">
        <form
          method="post"
          action="/api/library/upload"
          encType="multipart/form-data"
          className="flex flex-wrap items-center gap-2"
        >
          <select name="kind" className={`${selectClass} w-28`} defaultValue="OTHER">
            <option value="BEFORE">Before</option>
            <option value="AFTER">After</option>
            <option value="OTHER">Other</option>
          </select>
          <input
            type="file"
            name="files"
            accept="image/*"
            multiple
            required
            className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-300"
          />
          <button type="submit" className={btnSecondary}>
            Upload
          </button>
          <span className="text-xs text-slate-400">
            Tip: photos added on a job page land here too, already labeled.
          </span>
        </form>
      </Card>

      <div className="mb-4 flex gap-1">
        {KINDS.map((option) => (
          <Link
            key={option}
            href={option === 'ALL' ? '/library' : `/library?kind=${option}`}
            className={clsx(
              'rounded-lg px-3 py-1.5 text-sm font-medium capitalize',
              kind === option ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-200',
            )}
          >
            {option.toLowerCase()}
          </Link>
        ))}
      </div>

      {photos.length === 0 ? (
        <EmptyState title="No photos here yet" hint="Upload some, or add them from a job page." />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {photos.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              back={back}
              footer={
                photo.job ? (
                  <figcaption className="truncate px-2 py-1.5 text-xs text-slate-500">
                    <Link href={`/jobs/${photo.job.id}`} className="hover:underline">
                      {photo.job.vehicle.make} {photo.job.vehicle.model} · {photo.job.customer.name}
                    </Link>
                  </figcaption>
                ) : (
                  <figcaption className="truncate px-2 py-1.5 text-xs text-slate-400">
                    {photo.originalName || 'Standalone upload'}
                  </figcaption>
                )
              }
            />
          ))}
        </div>
      )}
    </div>
  )
}
