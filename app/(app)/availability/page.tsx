import Link from 'next/link'
import { addAvailabilityBlockAction, removeAvailabilityBlockAction } from '@/app/actions/bookings'
import { BookingActionForm } from '@/components/BookingActionForm'
import { bookingInput } from '@/components/bookingStyles'
import { Card, EmptyState, Field, PageHeader } from '@/components/ui'
import { requireOwner } from '@/lib/auth/session'
import { formatDateTime } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { getSettings } from '@/lib/ops/settings'

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
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Availability & time off"
        subtitle={`Times shown in ${settings.timezone}.`}
        actions={
          <Link href="/onboarding" className="text-sm font-semibold text-emerald-700">
            Edit regular hours →
          </Link>
        }
      />
      <Card title="Block time for travel, lunch or a day off">
        <p className="mb-4 text-sm text-slate-500">
          New customer bookings cannot overlap a block. Existing appointments stay on your schedule;
          contact those customers if plans change.
        </p>
        <BookingActionForm action={addAvailabilityBlockAction} label="Block this time">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts">
              <input className={bookingInput} name="startsAt" type="datetime-local" required />
            </Field>
            <Field label="Ends">
              <input className={bookingInput} name="endsAt" type="datetime-local" required />
            </Field>
          </div>
          <Field label="Reason (visible only to your team)">
            <input className={bookingInput} name="reason" maxLength={200} placeholder="Time off" />
          </Field>
        </BookingActionForm>
      </Card>
      <div className="mt-6">
        <Card title="Upcoming blocked time">
          {!blocks.length ? (
            <EmptyState
              title="No time off blocked"
              hint="Your regular working hours determine customer availability."
            />
          ) : (
            <div className="divide-y divide-slate-100">
              {blocks.map((block) => (
                <div
                  key={block.id}
                  className="flex flex-wrap items-center justify-between gap-3 py-4"
                >
                  <div>
                    <p className="text-sm font-semibold">{block.reason || 'Blocked time'}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDateTime(block.startsAt, settings.timezone)} →{' '}
                      {formatDateTime(block.endsAt, settings.timezone)}
                    </p>
                  </div>
                  <form action={removeAvailabilityBlockAction}>
                    <input name="id" type="hidden" value={block.id} />
                    <button
                      type="submit"
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold"
                    >
                      Remove block
                    </button>
                  </form>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
