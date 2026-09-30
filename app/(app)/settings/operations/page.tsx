import { SettingsNav } from '@/components/SettingsNav'
import { Card, PageHeader } from '@/components/ui'
import { requireOwner } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { launchReadiness } from '@/lib/readiness'

export const metadata = { title: 'Operations' }
export default async function OperationsPage() {
  const user = await requireOwner()
  const [edits, mail] = await Promise.all([
    prisma.aiRun.groupBy({ by: ['status'], where: { businessId: user.businessId }, _count: true }),
    prisma.notificationOutbox.groupBy({
      by: ['status'],
      where: { businessId: user.businessId },
      _count: true,
    }),
  ])
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Operations" subtitle="Editing progress and appointment message delivery" />
      <SettingsNav current="/settings/operations" isOwner />
      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Marketing and shorts">
          <ul className="space-y-2 text-sm">
            {edits.length ? (
              edits.map((row) => (
                <li key={row.status}>
                  {row.status.toLowerCase().replaceAll('_', ' ')}: {row._count}
                </li>
              ))
            ) : (
              <li>No runs yet.</li>
            )}
          </ul>
        </Card>
        <Card title="Appointment emails">
          <ul className="space-y-2 text-sm">
            {mail.length ? (
              mail.map((row) => (
                <li key={row.status}>
                  {row.status.toLowerCase()}: {row._count}
                </li>
              ))
            ) : (
              <li>No messages yet.</li>
            )}
          </ul>
        </Card>
      </div>
      <Card title="Connected services">
        <ul className="space-y-2 text-sm">
          {launchReadiness()
            .filter((check) => !check.name.includes('Database') && !check.name.includes('origin'))
            .map((check) => (
              <li key={check.name} className="flex justify-between gap-4">
                <span>{check.name}</span>
                <span>{check.ready ? 'Connected' : 'Not connected'}</span>
              </li>
            ))}
        </ul>
      </Card>
    </div>
  )
}
