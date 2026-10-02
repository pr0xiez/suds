import { InfoIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { Callout, linkClass, PageHeader } from '@/components/ui'
import { VideoEditor } from '@/components/VideoEditor'
import { requireOwner } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { demoEnabled } from '@/lib/demo'
import { photoShortsConfigured } from '@/lib/ops/photoShorts'
import { durableStorageConfigured } from '@/lib/storage'
import { videoEditingConfigured } from '@/lib/videoEditing'

export const metadata = { title: 'AI video editor' }
export default async function ShortsPage() {
  const user = await requireOwner()
  const photos = await prisma.photo.findMany({
    where: { businessId: user.businessId, approvedForMarketing: true },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return (
    <div>
      <PageHeader
        title="Edit a short with AI"
        subtitle="Upload a clip, choose a style, review it before posting."
        back={{ href: '/social', label: 'Content calendar' }}
      />
      {demoEnabled() && (
        <Callout
          tone="info"
          icon={InfoIcon}
          className="mb-6"
          title="Live video editing needs connected providers and private cloud storage."
        >
          Try the{' '}
          <Link href="/demo/workflow#owner/shorts" className={linkClass}>
            interactive photo and video editing preview
          </Link>{' '}
          to choose sources, review a sample storyboard, and save a demo draft.
        </Callout>
      )}
      <VideoEditor
        configured={videoEditingConfigured() && durableStorageConfigured()}
        photosConfigured={photoShortsConfigured()}
        photos={photos.map((photo) => ({
          id: photo.id,
          label: `${photo.kind} · ${photo.originalName || 'Job photo'}`,
        }))}
        userId={user.id}
      />
    </div>
  )
}
