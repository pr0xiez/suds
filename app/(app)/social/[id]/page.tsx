import {
  ArrowCounterClockwiseIcon,
  ArrowSquareOutIcon,
  CheckIcon,
  ClipboardTextIcon,
  CopyIcon,
  DownloadSimpleIcon,
  TrashIcon,
} from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { deletePostAction, markPostedAction, revertToDraftAction } from '@/app/actions/social'
import { ErrorBanner, SuccessBanner } from '@/components/banners'
import { ConfirmSubmit } from '@/components/ConfirmSubmit'
import { CopyButton } from '@/components/CopyButton'
import { PostComposer } from '@/components/PostComposer'
import {
  btnDanger,
  btnSecondary,
  btnSmall,
  Card,
  PageHeader,
  PLATFORM_META,
  PostStatusBadge,
} from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { describeVehicle } from '@/lib/captions'
import { formatDateTime, toDatetimeLocalValue } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { getSettings } from '@/lib/ops/settings'
import { buildCaptionContext, postInclude } from '@/lib/ops/social'
import { platformOpenUrl } from '@/lib/socialLinks'

export const metadata = { title: 'Post' }

export default async function PostPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  const { error, saved } = await searchParams
  const [settings, post, photos, templates] = await Promise.all([
    getSettings(user.businessId),
    prisma.socialPost.findUnique({
      where: { businessId: user.businessId, id },
      include: postInclude,
    }),
    prisma.photo.findMany({
      where: { businessId: user.businessId, approvedForMarketing: true },
      include: { job: { include: { vehicle: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.captionTemplate.findMany({
      where: { businessId: user.businessId },
      orderBy: { name: 'asc' },
    }),
  ])
  if (!post) notFound()
  const tz = settings.timezone

  const overdue =
    post.status === 'SCHEDULED' && post.scheduledFor !== null && post.scheduledFor < new Date()

  return (
    <div>
      <PageHeader
        title="Post"
        back={{ href: '/social', label: 'Content calendar' }}
        subtitle={
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <PostStatusBadge status={post.status} overdue={overdue} />
            <span className="min-w-0">
              {post.status === 'POSTED' && post.postedAt
                ? `Posted ${formatDateTime(post.postedAt, tz)}`
                : post.scheduledFor
                  ? `Scheduled for ${formatDateTime(post.scheduledFor, tz)}`
                  : 'Not scheduled yet'}
              {post.job
                ? ` · from ${describeVehicle(post.job.vehicle)} (${post.job.customer.name})`
                : ''}
            </span>
          </span>
        }
        actions={
          <>
            {post.job ? (
              <Link href={`/jobs/${post.job.id}`} className={btnSecondary}>
                <ClipboardTextIcon aria-hidden />
                View job
              </Link>
            ) : null}
            {post.status === 'POSTED' ? (
              <form action={revertToDraftAction}>
                <input type="hidden" name="id" value={post.id} />
                <button type="submit" className={btnSecondary}>
                  <ArrowCounterClockwiseIcon aria-hidden />
                  Back to draft
                </button>
              </form>
            ) : (
              <form action={markPostedAction}>
                <input type="hidden" name="id" value={post.id} />
                <input type="hidden" name="back" value={`/social/${post.id}`} />
                <button type="submit" className={btnSecondary}>
                  <CheckIcon aria-hidden />
                  Mark posted
                </button>
              </form>
            )}
            <form action={deletePostAction}>
              <input type="hidden" name="id" value={post.id} />
              <ConfirmSubmit
                message="Delete this post? Photos stay in the library."
                className={btnDanger}
              >
                <TrashIcon aria-hidden />
                Delete
              </ConfirmSubmit>
            </form>
          </>
        }
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={saved ? 'Saved.' : null} />

      {post.status !== 'DRAFT' ? (
        <Card title="Posting kit" className="mb-6" padded={false}>
          <ol className="divide-y divide-line">
            <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
              <span className="flex min-w-0 items-center gap-3 text-sm text-ink sm:w-56 sm:shrink-0">
                <StepNumber n={1} />
                Copy the caption and photos
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                <CopyButton text={post.caption} className={`${btnSecondary} ${btnSmall}`}>
                  <CopyIcon aria-hidden />
                  Copy caption
                </CopyButton>
                {post.photos
                  .filter((pp) => pp.photo.approvedForMarketing)
                  .map((pp, index) => (
                    <a
                      key={pp.photoId}
                      href={`/api/photos/${pp.photoId}`}
                      download={`post-photo-${index + 1}`}
                      className={`${btnSecondary} ${btnSmall}`}
                    >
                      <DownloadSimpleIcon aria-hidden />
                      Photo {index + 1}
                    </a>
                  ))}
              </span>
            </li>
            <li className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:px-5">
              <span className="flex min-w-0 items-center gap-3 text-sm text-ink sm:w-56 sm:shrink-0">
                <StepNumber n={2} />
                Post it in each app
              </span>
              <span className="flex min-w-0 flex-wrap items-center gap-2">
                {post.platforms.map((platform) => {
                  const PlatformIcon = PLATFORM_META[platform].icon
                  return (
                    <a
                      key={platform}
                      href={platformOpenUrl(platform, settings)}
                      target="_blank"
                      rel="noreferrer"
                      className={`${btnSecondary} ${btnSmall}`}
                    >
                      <PlatformIcon aria-hidden />
                      Open {PLATFORM_META[platform].label}
                      <ArrowSquareOutIcon aria-hidden className="text-ink-faint" />
                    </a>
                  )
                })}
              </span>
            </li>
            <li className="flex items-center gap-3 px-4 py-3.5 text-sm text-ink sm:px-5">
              <StepNumber n={3} />
              <span className="min-w-0">
                Then choose <span className="font-medium">Mark posted</span> here.
              </span>
            </li>
          </ol>
        </Card>
      ) : null}

      <PostComposer
        photos={photos.map((p) => ({
          id: p.id,
          kind: p.kind,
          label: p.job
            ? `${p.job.vehicle.make} ${p.job.vehicle.model}`
            : p.originalName || 'Upload',
        }))}
        templates={templates}
        templateContext={buildCaptionContext(post.job, settings)}
        hashtags={settings.hashtags}
        initial={{
          postId: post.id,
          caption: post.caption,
          platforms: post.platforms,
          scheduledFor: post.scheduledFor ? toDatetimeLocalValue(post.scheduledFor, tz) : '',
          jobId: post.jobId ?? '',
          photoIds: post.photos
            .filter((pp) => pp.photo.approvedForMarketing)
            .map((pp) => pp.photoId),
        }}
      />
    </div>
  )
}

function StepNumber({ n }: { n: number }) {
  return (
    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-semibold tabular-nums text-ink-muted">
      {n}
    </span>
  )
}
