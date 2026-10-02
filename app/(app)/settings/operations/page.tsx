import { CheckCircleIcon } from '@phosphor-icons/react/ssr'
import { SettingsNav } from '@/components/SettingsNav'
import { Badge, Card, PageHeader, type Tone } from '@/components/ui'
import { requireOwner } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { launchReadiness } from '@/lib/readiness'

export const metadata = { title: 'Operations' }

/** Queue states are free-form strings; group them into the shared status tones. */
function queueTone(status: string): Tone {
  if (['COMPLETED', 'READY', 'SENT', 'PUBLISHED', 'SUCCEEDED', 'DELIVERED'].includes(status))
    return 'ok'
  if (['FAILED', 'ERROR'].includes(status)) return 'danger'
  if (['CANCELED', 'CANCELLED', 'EXPIRED', 'SKIPPED'].includes(status)) return 'neutral'
  return 'warn'
}

function QueueRows({
  rows,
  label,
  empty,
}: {
  rows: Array<{ status: string; _count: number }>
  label: (status: string) => string
  empty: string
}) {
  if (!rows.length) return <p className="px-4 py-4 text-sm text-ink-muted sm:px-5">{empty}</p>
  return (
    <ul className="divide-y divide-line">
      {rows.map((row) => (
        <li key={row.status} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          <Badge tone={queueTone(row.status)}>
            <span className="block first-letter:uppercase">{label(row.status)}</span>
          </Badge>
          <span className="text-sm font-semibold tabular-nums text-ink">{row._count}</span>
        </li>
      ))}
    </ul>
  )
}

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
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <SettingsNav current="/settings/operations" isOwner />
      <div className="mb-6">
        <h2 className="font-display text-lg font-bold text-ink">Operations</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Editing progress and appointment message delivery.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Card title="Marketing and shorts" padded={false}>
          <QueueRows
            rows={edits}
            label={(status) => status.toLowerCase().replaceAll('_', ' ')}
            empty="No runs yet."
          />
        </Card>
        <Card title="Appointment emails" padded={false}>
          <QueueRows
            rows={mail}
            label={(status) => status.toLowerCase()}
            empty="No messages yet."
          />
        </Card>
      </div>
      <Card title="Connected services" padded={false} className="mt-6">
        <ul className="divide-y divide-line">
          {launchReadiness()
            .filter((check) => !check.name.includes('Database') && !check.name.includes('origin'))
            .map((check) => (
              <li
                key={check.name}
                className="flex items-center justify-between gap-4 px-4 py-3 sm:px-5"
              >
                <span className="min-w-0 text-sm text-ink">{check.name}</span>
                {check.ready ? (
                  <Badge tone="ok">
                    <CheckCircleIcon aria-hidden className="size-3.5" />
                    Connected
                  </Badge>
                ) : (
                  <Badge>Not connected</Badge>
                )}
              </li>
            ))}
        </ul>
      </Card>
    </div>
  )
}
