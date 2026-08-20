import { PostComposer } from '@/components/PostComposer'
import { PageHeader } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { getSettings } from '@/lib/ops/settings'
import { buildCaptionContext } from '@/lib/ops/social'

export const metadata = { title: 'New post' }

export default async function NewPostPage() {
  await requireUser()
  const [settings, photos, templates] = await Promise.all([
    getSettings(),
    prisma.photo.findMany({
      include: { job: { include: { vehicle: true } } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    }),
    prisma.captionTemplate.findMany({ orderBy: { name: 'asc' } }),
  ])

  return (
    <div>
      <PageHeader title="New post" subtitle="Pick photos, write the caption, queue it up" />
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
          caption: '',
          platforms: ['INSTAGRAM', 'FACEBOOK'],
          scheduledFor: '',
          jobId: '',
          photoIds: [],
        }}
      />
    </div>
  )
}
