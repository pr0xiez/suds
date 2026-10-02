import { PostComposer } from '@/components/PostComposer'
import { PageHeader } from '@/components/ui'
import { loadMarketingPostBrief } from '@/lib/ai/marketingPosts'
import { requireOwner, requireUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { getSettings } from '@/lib/ops/settings'
import { buildCaptionContext } from '@/lib/ops/social'

export const metadata = { title: 'New post' }

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ aiRunId?: string }>
}) {
  const user = await requireUser()
  const query = await searchParams
  const initialBrief = query.aiRunId
    ? await loadMarketingPostBrief((await requireOwner()).businessId, query.aiRunId)
    : null
  const [settings, photos, templates] = await Promise.all([
    getSettings(user.businessId),
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

  return (
    <div>
      <PageHeader
        title="New post"
        subtitle="Pick photos, write the caption, queue it up"
        back={{ href: '/social', label: 'Content calendar' }}
      />
      <PostComposer
        photos={photos.map((p) => ({
          id: p.id,
          kind: p.kind,
          label: p.job
            ? `${p.job.vehicle.make} ${p.job.vehicle.model}`
            : p.originalName || 'Upload',
        }))}
        templates={templates}
        templateContext={buildCaptionContext(null, settings)}
        hashtags={settings.hashtags}
        initial={{
          postId: '',
          caption: initialBrief?.caption ?? '',
          platforms: initialBrief?.platforms ?? ['INSTAGRAM', 'FACEBOOK'],
          scheduledFor: '',
          jobId: initialBrief?.jobId ?? '',
          photoIds: initialBrief?.photoIds ?? [],
        }}
      />
    </div>
  )
}
