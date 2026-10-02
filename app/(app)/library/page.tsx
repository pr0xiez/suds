import { ImagesIcon, LockSimpleIcon, UploadSimpleIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { ErrorBanner } from '@/components/banners'
import { MediaUploader } from '@/components/MediaUploader'
import { PhotoTile } from '@/components/PhotoTile'
import {
  btnSecondary,
  Card,
  EmptyState,
  Field,
  PageHeader,
  PHOTO_KIND_META,
  segmentClass,
  segmentTrack,
  selectClass,
} from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import type { Prisma } from '@/lib/generated/prisma/client'
import { durableStorageConfigured } from '@/lib/storage'

export const metadata = { title: 'Library' }

const KINDS = ['ALL', 'AFTER', 'BEFORE', 'OTHER'] as const
type KindFilter = (typeof KINDS)[number]

/** The native file picker button restyled as a quiet secondary control. */
const fileInputClass =
  'block min-h-10 w-full cursor-pointer rounded-control border border-line-strong bg-surface px-1 py-1 text-sm text-ink-muted transition-colors hover:border-ink-faint focus:border-focus focus:outline-none focus:ring-3 focus:ring-focus/20 file:mr-3 file:cursor-pointer file:rounded-[0.5rem] file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-sm file:font-medium file:text-ink hover:file:bg-surface-3'

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string; error?: string }>
}) {
  const user = await requireUser()
  const params = await searchParams
  const kind: KindFilter = KINDS.includes(params.kind as KindFilter)
    ? (params.kind as KindFilter)
    : 'ALL'

  const where: Prisma.PhotoWhereInput = kind === 'ALL' ? {} : { kind }
  const photos = await prisma.photo.findMany({
    where: { ...where, businessId: user.businessId },
    include: { job: { include: { vehicle: true, customer: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  })

  const back = kind === 'ALL' ? '/library' : `/library?kind=${kind}`

  return (
    <div>
      <PageHeader
        title="Library"
        subtitle="Every photo in one place: job shots and standalone uploads"
      />
      <ErrorBanner message={params.error} />

      <Card title="Add photos">
        {durableStorageConfigured() ? (
          <MediaUploader />
        ) : (
          <form
            method="post"
            action="/api/library/upload"
            encType="multipart/form-data"
            className="grid grid-cols-1 gap-3 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-end"
          >
            <Field label="Photo kind">
              <select name="kind" className={selectClass} defaultValue="OTHER">
                <option value="BEFORE">Before</option>
                <option value="AFTER">After</option>
                <option value="OTHER">Other</option>
              </select>
            </Field>
            <Field label="Photos">
              <input
                type="file"
                name="files"
                accept="image/*"
                multiple
                required
                className={fileInputClass}
              />
            </Field>
            <button type="submit" className={btnSecondary}>
              <UploadSimpleIcon aria-hidden />
              Upload
            </button>
            <p className="text-xs text-ink-muted sm:col-span-3">
              Tip: photos added on a job page land here too, already labeled.
            </p>
          </form>
        )}
      </Card>

      <div className="mt-6 mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <nav aria-label="Filter by photo kind" className={segmentTrack}>
          {KINDS.map((option) => (
            <Link
              key={option}
              href={option === 'ALL' ? '/library' : `/library?kind=${option}`}
              aria-current={kind === option ? 'page' : undefined}
              className={segmentClass(kind === option)}
            >
              {option === 'ALL' ? 'All' : PHOTO_KIND_META[option].label}
            </Link>
          ))}
        </nav>
        <p className="flex min-w-0 items-start gap-1.5 text-sm text-ink-muted">
          <LockSimpleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            <span className="font-medium tabular-nums text-ink">
              {photos.length} photo{photos.length === 1 ? '' : 's'}
            </span>
            . Each stays private until an owner approves it for marketing.
          </span>
        </p>
      </div>

      {photos.length === 0 ? (
        <EmptyState
          icon={ImagesIcon}
          title="No photos here yet"
          hint="Upload some, or add them from a job page."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5">
          {photos.map((photo) => (
            <PhotoTile
              key={photo.id}
              photo={photo}
              canApprove={user.businessRole === 'OWNER'}
              back={back}
              footer={
                photo.job ? (
                  <figcaption className="truncate px-2 pt-2 text-xs text-ink-muted">
                    <Link
                      href={`/jobs/${photo.job.id}`}
                      className="transition-colors hover:text-ink hover:underline"
                    >
                      <span className="font-medium text-ink">
                        {photo.job.vehicle.make} {photo.job.vehicle.model}
                      </span>{' '}
                      · {photo.job.customer.name}
                    </Link>
                  </figcaption>
                ) : (
                  <figcaption className="truncate px-2 pt-2 text-xs text-ink-faint">
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
