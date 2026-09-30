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

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">Post</h1>
            <PostStatusBadge
              status={post.status}
              overdue={
                post.status === 'SCHEDULED' &&
                post.scheduledFor !== null &&
                post.scheduledFor < new Date()
              }
            />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {post.status === 'POSTED' && post.postedAt
              ? `Posted ${formatDateTime(post.postedAt, tz)}`
              : post.scheduledFor
                ? `Scheduled for ${formatDateTime(post.scheduledFor, tz)}`
                : 'Not scheduled yet'}
            {post.job
              ? ` · from ${describeVehicle(post.job.vehicle)} (${post.job.customer.name})`
              : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {post.job ? (
            <Link href={`/jobs/${post.job.id}`} className={btnSecondary}>
              View job
            </Link>
          ) : null}
          {post.status === 'POSTED' ? (
            <form action={revertToDraftAction}>
              <input type="hidden" name="id" value={post.id} />
              <button type="submit" className={btnSecondary}>
                Back to draft
              </button>
            </form>
          ) : (
            <form action={markPostedAction}>
              <input type="hidden" name="id" value={post.id} />
              <input type="hidden" name="back" value={`/social/${post.id}`} />
              <button type="submit" className={btnSecondary}>
                Mark posted ✓
              </button>
            </form>
          )}
          <form action={deletePostAction}>
            <input type="hidden" name="id" value={post.id} />
            <ConfirmSubmit
              message="Delete this post? Photos stay in the library."
              className={btnDanger}
            >
              Delete
            </ConfirmSubmit>
          </form>
        </div>
      </div>

      <ErrorBanner message={error} />
      <SuccessBanner message={saved ? 'Saved.' : null} />

      {post.status !== 'DRAFT' ? (
        <Card title="Posting kit" className="mb-6">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <CopyButton text={post.caption} className={`${btnSecondary} ${btnSmall}`}>
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
                  ↓ Photo {index + 1}
                </a>
              ))}
            {post.platforms.map((platform) => (
              <a
                key={platform}
                href={platformOpenUrl(platform, settings)}
                target="_blank"
                rel="noreferrer"
                className={`${btnSecondary} ${btnSmall}`}
              >
                Open {PLATFORM_META[platform].label} ↗
              </a>
            ))}
            <span className="text-xs text-slate-400">
              Download → post in the app → “Mark posted ✓”
            </span>
          </div>
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
