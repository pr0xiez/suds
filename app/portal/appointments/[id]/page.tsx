import {
  CalendarCheckIcon,
  CalendarPlusIcon,
  PhoneIcon,
  ReceiptIcon,
} from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { changeBookingAction } from '@/app/actions/bookings'
import { BookingActionForm } from '@/components/BookingActionForm'
import { SuccessBanner } from '@/components/banners'
import { bookingButton, bookingInput } from '@/components/bookingStyles'
import { Badge, btnSecondary, Card, Field, PageHeader, type Tone } from '@/components/ui'
import { bookingTimeLabel } from '@/lib/bookingAvailability'
import { requirePortalUser } from '@/lib/bookingCustomer'
import { addDays, dateKey, formatDateTime, todayWall } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { formatCents } from '@/lib/money'
import { bookingServices, customerRescheduleAvailability } from '@/lib/ops/bookings'

/** Same states as before, now labelled in sentence case with a status tone. */
function bookingBadge(status: string, jobStatus: string | undefined): [string, Tone] {
  if (jobStatus === 'COMPLETED') return ['Completed', 'ok']
  if (status === 'PENDING') return ['Awaiting detailer approval', 'warn']
  const label = status.toLowerCase()
  const text = `${label.charAt(0).toUpperCase()}${label.slice(1)}`
  if (status === 'CONFIRMED') return [text, 'info']
  if (status === 'DECLINED') return [text, 'danger']
  return [text, 'neutral']
}

const secondaryButton = clsx(btnSecondary, 'min-h-11! px-5!')
const detailRow =
  'grid grid-cols-1 gap-1 px-5 py-3.5 sm:grid-cols-[7rem_minmax(0,1fr)] sm:gap-4 sm:px-6'
const detailTerm = 'text-sm text-ink-muted'
const detailValue = 'min-w-0 text-sm text-ink'

export default async function CustomerAppointmentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ day?: string; created?: string; updated?: string }>
}) {
  const { id } = await params
  const user = await requirePortalUser(`/portal/appointments/${id}`)
  const booking = await prisma.booking.findFirst({
    where: { id, customer: { userId: user.id } },
    select: {
      id: true,
      status: true,
      scheduledAt: true,
      priceCents: true,
      address: true,
      customerNotes: true,
      waterPowerNotes: true,
      serviceSnapshots: true,
      vehicle: { select: { year: true, make: true, model: true } },
      job: { select: { id: true, status: true, invoiceNumber: true } },
      business: {
        select: {
          name: true,
          slug: true,
          status: true,
          settings: {
            select: { phone: true, timezone: true, horizonDays: true, cancellationHours: true },
          },
        },
      },
    },
  })
  if (!booking?.business.settings) notFound()
  const settings = booking.business.settings
  const query = await searchParams
  const day = typeof query.day === 'string' ? query.day : dateKey(todayWall(settings.timezone))
  const changeable =
    ['PENDING', 'CONFIRMED'].includes(booking.status) &&
    (!booking.job || booking.job.status === 'SCHEDULED') &&
    booking.scheduledAt.getTime() >= Date.now() + settings.cancellationHours * 60 * 60_000
  const slots = changeable ? await customerRescheduleAvailability(user.id, booking.id, day) : []
  const [statusLabel, statusTone] = bookingBadge(booking.status, booking.job?.status)
  return (
    <div data-portal-section="appointments">
      <PageHeader
        title={booking.business.name}
        back={{ href: '/portal', label: 'My appointments' }}
      />
      {query.created || query.updated ? (
        <SuccessBanner
          message={
            query.created
              ? booking.status === 'PENDING'
                ? 'Your request is saved. The detailer will confirm it after reviewing availability.'
                : booking.status === 'CONFIRMED'
                  ? 'Your appointment is confirmed.'
                  : 'This booking has already changed. See its current status below.'
              : 'Your appointment has been updated.'
          }
        />
      ) : null}
      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
        <Card padded={false}>
          <div className="p-5 sm:p-6">
            <Badge tone={statusTone}>{statusLabel}</Badge>
            <h2 className="mt-3 text-2xl font-semibold leading-tight tabular-nums text-ink">
              {formatDateTime(booking.scheduledAt, settings.timezone)}
            </h2>
            <p className="mt-1 text-sm text-ink-muted">{settings.timezone}</p>
          </div>
          <dl className="divide-y divide-line border-t border-line">
            <div className={detailRow}>
              <dt className={detailTerm}>Service</dt>
              <dd className={clsx(detailValue, 'font-medium')}>
                {bookingServices(booking.serviceSnapshots)
                  .map((service) => service.name)
                  .join(' + ')}
              </dd>
            </div>
            <div className={detailRow}>
              <dt className={detailTerm}>Vehicle</dt>
              <dd className={detailValue}>
                {booking.vehicle.year} {booking.vehicle.make} {booking.vehicle.model}
              </dd>
            </div>
            <div className={detailRow}>
              <dt className={detailTerm}>Location</dt>
              <dd className={clsx(detailValue, 'whitespace-pre-wrap break-words')}>
                {booking.address}
              </dd>
            </div>
            {booking.waterPowerNotes ? (
              <div className={detailRow}>
                <dt className={detailTerm}>Access</dt>
                <dd className={clsx(detailValue, 'break-words')}>{booking.waterPowerNotes}</dd>
              </div>
            ) : null}
            {booking.customerNotes ? (
              <div className={detailRow}>
                <dt className={detailTerm}>Your note</dt>
                <dd className={clsx(detailValue, 'break-words')}>{booking.customerNotes}</dd>
              </div>
            ) : null}
            <div className={detailRow}>
              <dt className={detailTerm}>Price</dt>
              <dd className={detailValue}>
                <span className="text-lg font-semibold tabular-nums">
                  {formatCents(booking.priceCents)}
                </span>
                <span className="mt-0.5 block text-xs text-ink-muted">
                  Payment arranged with your detailer.
                </span>
              </dd>
            </div>
          </dl>
          {booking.job?.invoiceNumber || settings.phone ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-5 py-4 sm:px-6">
              {booking.job?.invoiceNumber ? (
                <Link className={secondaryButton} href={`/portal/invoices/${booking.job.id}`}>
                  <ReceiptIcon aria-hidden />
                  View invoice #{booking.job.invoiceNumber}
                </Link>
              ) : null}
              {settings.phone ? (
                <p className="flex items-center gap-2 text-sm text-ink-muted">
                  <PhoneIcon aria-hidden className="size-4 shrink-0" />
                  <span>
                    Questions?{' '}
                    <span className="font-medium tabular-nums text-ink">{settings.phone}</span>
                  </span>
                </p>
              ) : null}
            </div>
          ) : null}
        </Card>
        {changeable ? (
          <Card>
            <h2 className="text-base font-semibold text-ink">Need another time?</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Changes require {settings.cancellationHours} hours notice.
            </p>
            <form method="get" className="mt-5 mb-5 flex items-end gap-2">
              <Field label="Choose a day" className="min-w-0 flex-1">
                <input
                  className={bookingInput}
                  type="date"
                  name="day"
                  defaultValue={day}
                  min={dateKey(todayWall(settings.timezone))}
                  max={dateKey(addDays(todayWall(settings.timezone), settings.horizonDays))}
                />
              </Field>
              <button type="submit" className={clsx(secondaryButton, 'shrink-0')}>
                Find times
              </button>
            </form>
            {slots.length ? (
              <BookingActionForm
                action={changeBookingAction}
                label="Move appointment"
                icon={<CalendarCheckIcon aria-hidden />}
              >
                <input name="id" type="hidden" value={booking.id} />
                <input name="intent" type="hidden" value="reschedule" />
                <Field label="Available time">
                  <select
                    className={`${bookingInput} pr-8`}
                    name="scheduledAt"
                    required
                    defaultValue=""
                  >
                    <option value="" disabled>
                      Choose a time
                    </option>
                    {slots.map((slot) => (
                      <option key={slot.toISOString()} value={slot.toISOString()}>
                        {bookingTimeLabel(slot, settings.timezone)}
                      </option>
                    ))}
                  </select>
                </Field>
                <p className="text-xs leading-relaxed text-ink-muted">
                  An already confirmed appointment stays confirmed when you move it to an available
                  time.
                </p>
              </BookingActionForm>
            ) : (
              <p className="rounded-control border border-dashed border-line-strong/60 px-4 py-3 text-sm text-ink-muted">
                No available times on this day. Try another day.
              </p>
            )}
            <div className="mt-6 border-t border-line pt-5">
              <BookingActionForm action={changeBookingAction} label="Cancel appointment" danger>
                <input name="id" type="hidden" value={booking.id} />
                <input name="intent" type="hidden" value="cancel" />
                <label className="flex items-start gap-3 text-sm text-ink-muted">
                  <input type="checkbox" required className="mt-0.5 size-4 shrink-0" />
                  <span className="min-w-0">I want to cancel this appointment.</span>
                </label>
              </BookingActionForm>
            </div>
          </Card>
        ) : (
          <Card>
            <h2 className="text-base font-semibold text-ink">Your next clean</h2>
            <p className="mt-1.5 text-sm text-ink-muted">
              {['PENDING', 'CONFIRMED'].includes(booking.status)
                ? 'This appointment can no longer be changed online. Contact your detailer for help.'
                : 'Ready for another detail? Choose a new appointment.'}
            </p>
            {booking.business.status === 'PUBLISHED' ? (
              <Link className={`${bookingButton} mt-5`} href={`/b/${booking.business.slug}`}>
                <CalendarPlusIcon aria-hidden />
                Book again
              </Link>
            ) : null}
          </Card>
        )}
      </div>
    </div>
  )
}
