import {
  ArrowRightIcon,
  CalendarBlankIcon,
  CheckIcon,
  GearSixIcon,
  InfoIcon,
  TrayIcon,
  XIcon,
} from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { decideBookingAction } from '@/app/actions/bookings'
import { ErrorBanner } from '@/components/banners'
import {
  Badge,
  btnDanger,
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  linkClass,
  PageHeader,
  type Tone,
} from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { formatDateTime } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import type { BookingStatus } from '@/lib/generated/prisma/enums'
import { formatCents } from '@/lib/money'
import { bookingServices } from '@/lib/ops/bookings'
import { getSettings } from '@/lib/ops/settings'

const BOOKING_STATUS: Record<BookingStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Pending', tone: 'warn' },
  CONFIRMED: { label: 'Confirmed', tone: 'info' },
  DECLINED: { label: 'Declined', tone: 'neutral' },
  CANCELED: { label: 'Canceled', tone: 'neutral' },
}

/** One labeled fact on a request card. */
function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 px-4 py-2.5 sm:px-5">
      <dt className="w-16 shrink-0 text-ink-muted">{label}</dt>
      <dd className="min-w-0 flex-1 wrap-break-word text-ink">{children}</dd>
    </div>
  )
}

export default async function BookingRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await requireUser()
  const [settings, bookings, query] = await Promise.all([
    getSettings(user.businessId),
    prisma.booking.findMany({
      where: { businessId: user.businessId },
      orderBy: [{ status: 'asc' }, { scheduledAt: 'asc' }],
      take: 100,
      include: {
        customer: { select: { name: true, phone: true, email: true } },
        vehicle: { select: { make: true, model: true } },
      },
    }),
    searchParams,
  ])
  const pending = bookings.filter((booking) => booking.status === 'PENDING')
  const recent = bookings.filter((booking) => booking.status !== 'PENDING')
  return (
    <div>
      <PageHeader
        title="Customer bookings"
        subtitle="Review requests and see appointments booked through your public page."
        actions={
          <Link href="/onboarding" className={btnSecondary}>
            <GearSixIcon aria-hidden />
            Booking settings
          </Link>
        }
      />
      <ErrorBanner message={query.error} />

      <section aria-labelledby="requests-heading">
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="requests-heading" className="font-display text-lg font-bold text-ink">
            Requests to review
          </h2>
          <Badge tone={pending.length ? 'warn' : 'neutral'} className="tabular-nums">
            {pending.length}
          </Badge>
        </div>
        <p className="mt-1 mb-4 flex items-start gap-1.5 text-sm text-ink-muted">
          <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-faint" />
          <span>
            A request does not reserve time. Suds checks the full service and travel buffer again
            when you accept it.
          </span>
        </p>
        {!pending.length ? (
          <Card>
            <EmptyState
              icon={TrayIcon}
              title="You’re all caught up"
              hint="New requests appear here when approval booking is enabled."
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {pending.map((booking) => (
              <article
                key={booking.id}
                aria-label={`Request from ${booking.customer.name}`}
                className="flex min-w-0 flex-col rounded-panel border border-line bg-surface shadow-panel"
              >
                <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-ink">{booking.customer.name}</h3>
                    <p className="mt-1 flex items-center gap-1.5 text-sm font-medium tabular-nums text-ink">
                      <CalendarBlankIcon aria-hidden className="size-4 shrink-0 text-ink-faint" />
                      {formatDateTime(booking.scheduledAt, settings.timezone)}
                    </p>
                  </div>
                  <Badge tone="warn">Awaiting approval</Badge>
                </header>
                <dl className="flex-1 divide-y divide-line py-1 text-sm">
                  <DetailRow label="Service">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="min-w-0">
                        {bookingServices(booking.serviceSnapshots)
                          .map((service) => service.name)
                          .join(' + ')}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {formatCents(booking.priceCents)}
                      </span>
                    </span>
                  </DetailRow>
                  <DetailRow label="Vehicle">
                    {booking.vehicle.make} {booking.vehicle.model}
                  </DetailRow>
                  <DetailRow label="Address">
                    <span className="whitespace-pre-wrap">{booking.address}</span>
                  </DetailRow>
                  {booking.waterPowerNotes ? (
                    <DetailRow label="Access">{booking.waterPowerNotes}</DetailRow>
                  ) : null}
                  {booking.customerNotes ? (
                    <DetailRow label="Note">{booking.customerNotes}</DetailRow>
                  ) : null}
                  <DetailRow label="Contact">
                    <span className="block tabular-nums">{booking.customer.phone}</span>
                    <span className="block text-ink-muted">{booking.customer.email}</span>
                  </DetailRow>
                </dl>
                <footer className="border-t border-line px-4 py-3 sm:px-5">
                  {user.businessRole === 'OWNER' ? (
                    <div className="flex gap-2">
                      <form action={decideBookingAction} className="flex-1 sm:flex-none">
                        <input name="id" type="hidden" value={booking.id} />
                        <button
                          type="submit"
                          name="decision"
                          value="accept"
                          className={`${btnPrimary} w-full`}
                        >
                          <CheckIcon aria-hidden />
                          Accept
                        </button>
                      </form>
                      <form action={decideBookingAction} className="flex-1 sm:flex-none">
                        <input name="id" type="hidden" value={booking.id} />
                        <button
                          type="submit"
                          name="decision"
                          value="decline"
                          className={`${btnDanger} w-full`}
                        >
                          <XIcon aria-hidden />
                          Decline
                        </button>
                      </form>
                    </div>
                  ) : (
                    <p className="py-1.5 text-sm text-ink-muted">
                      The business owner can accept or decline.
                    </p>
                  )}
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>

      <Card title="Other customer bookings" padded={false} className="mt-10">
        {!recent.length ? (
          <div className="p-4 sm:p-5">
            <EmptyState icon={CalendarBlankIcon} title="No customer bookings yet" />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {recent.map((booking) => (
              <li key={booking.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{booking.customer.name}</p>
                  <p className="mt-0.5 text-xs tabular-nums text-ink-muted">
                    {formatDateTime(booking.scheduledAt, settings.timezone)}
                  </p>
                </div>
                <Badge tone={BOOKING_STATUS[booking.status].tone}>
                  {BOOKING_STATUS[booking.status].label}
                </Badge>
                <span className="flex w-24 shrink-0 justify-end">
                  {booking.jobId ? (
                    <Link
                      className={`${linkClass} inline-flex items-center gap-1 text-sm`}
                      href={`/jobs/${booking.jobId}`}
                    >
                      Open job
                      <ArrowRightIcon aria-hidden className="size-3.5" />
                    </Link>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
