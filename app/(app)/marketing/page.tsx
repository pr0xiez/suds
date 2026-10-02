import { MarketingAssistant } from '@/components/MarketingAssistant'
import { PageHeader } from '@/components/ui'
import { marketingConfigured } from '@/lib/ai/marketing'
import { requireOwner } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { demoEnabled } from '@/lib/demo'
export const metadata = { title: 'Marketing assistant' }
export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ task?: string }>
}) {
  const initialTask = (await searchParams).task
  const user = await requireOwner()
  const [jobs, services, photos] = await Promise.all([
    prisma.job.findMany({
      where: { businessId: user.businessId, status: 'COMPLETED' },
      include: {
        vehicle: { select: { make: true, model: true } },
        items: { select: { name: true } },
      },
      orderBy: { completedAt: 'desc' },
      take: 30,
    }),
    prisma.service.findMany({
      where: { businessId: user.businessId, active: true },
      orderBy: { sort: 'asc' },
    }),
    prisma.photo.findMany({
      where: { businessId: user.businessId, approvedForMarketing: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
  ])
  return (
    <div>
      <PageHeader
        title="Your Suds marketing assistant"
        subtitle="Turn completed details and available times into marketing that brings customers to your booking page."
      />
      <MarketingAssistant
        demo={demoEnabled()}
        initialTask={initialTask}
        configured={marketingConfigured()}
        jobs={jobs.map((job) => ({
          id: job.id,
          label: `${job.vehicle.make} ${job.vehicle.model} · ${job.items.map((item) => item.name).join(', ')}`,
        }))}
        services={services.map((service) => ({ id: service.id, label: service.name }))}
        photos={photos.map((photo) => ({ id: photo.id, label: `${photo.kind} photo` }))}
      />
    </div>
  )
}
