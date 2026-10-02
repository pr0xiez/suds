import {
  ArrowRightIcon,
  CalendarSlashIcon,
  CalendarXIcon,
  ClockIcon,
} from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { addAvailabilityBlockAction, removeAvailabilityBlockAction } from '@/app/actions/bookings'
import { BookingActionForm } from '@/components/BookingActionForm'
import { SettingsNav } from '@/components/SettingsNav'
import {
  btnPrimary,
  btnSecondary,
  btnSmall,
  Card,
  EmptyState,
  Field,
  inputClass,
  PageHeader,
} from '@/components/ui'
import { requireOwner } from '@/lib/auth/session'
import { formatDateTime } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { getSettings } from '@/lib/ops/settings'

export const metadata = { title: 'Availability' }

export default async function AvailabilityPage() {
  const user = await requireOwner()
  const [settings, blocks] = await Promise.all([
    getSettings(user.businessId),
    prisma.availabilityBlock.findMany({
      where: { businessId: user.businessId, endsAt: { gt: new Date() } },
      orderBy: { startsAt: 'asc' },
      take: 100,
    }),
  ])
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <SettingsNav current="/availability" isOwner />
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-bold text-ink">Availability & time off</h2>
          <p className="mt-1 text-sm text-ink-muted">Times shown in {settings.timezone}.</p>
        </div>
        <Link href="/onboarding" className={btnSecondary}>
          <ClockIcon aria-hidden />
          Edit regular hours
        </Link>
      </div>

      <Card title="Block time for travel, lunch or a day off">
        <p className="mb-5 text-sm text-ink-muted">
          New customer bookings cannot overlap a block. Existing appointments stay on your schedule;
          contact those customers if plans change.
        </p>
        <BookingActionForm
          action={addAvailabilityBlockAction}
          label="Block this time"
          icon={<CalendarXIcon aria-hidden />}
          className="flex flex-col gap-5"
          submitClassName={`${btnPrimary} self-end`}
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Starts">
              <input className={inputClass} name="startsAt" type="datetime-local" required />
            </Field>
            <Field label="Ends">
              <input className={inputClass} name="endsAt" type="datetime-local" required />
            </Field>
          </div>
          <Field label="Reason" hint="Visible only to your team.">
            <input className={inputClass} name="reason" maxLength={200} placeholder="Time off" />
          </Field>
        </BookingActionForm>
      </Card>

      <Card title="Upcoming blocked time" padded={false} className="mt-6">
        {!blocks.length ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon={CalendarSlashIcon}
              title="No time off blocked"
              hint="Your regular working hours determine customer availability."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {blocks.map((block) => (
              <li key={block.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
                <span className="grid size-9 shrink-0 place-items-center rounded-control bg-surface-2 text-ink-muted">
                  <CalendarXIcon aria-hidden className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {block.reason || 'Blocked time'}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-xs tabular-nums text-ink-muted">
                    <span>{formatDateTime(block.startsAt, settings.timezone)}</span>
                    <ArrowRightIcon aria-hidden className="size-3 shrink-0" />
                    <span className="sr-only">to</span>
                    <span>{formatDateTime(block.endsAt, settings.timezone)}</span>
                  </p>
                </div>
                <form action={removeAvailabilityBlockAction} className="shrink-0">
                  <input name="id" type="hidden" value={block.id} />
                  <button type="submit" className={`${btnSecondary} ${btnSmall}`}>
                    Remove block
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
