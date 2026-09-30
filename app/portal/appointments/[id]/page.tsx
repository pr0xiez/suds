import Link from 'next/link'
import { notFound } from 'next/navigation'
import { changeBookingAction } from '@/app/actions/bookings'
import { BookingActionForm } from '@/components/BookingActionForm'
import { bookingButton, bookingInput } from '@/components/bookingStyles'
import { Field } from '@/components/ui'
import { bookingTimeLabel } from '@/lib/bookingAvailability'
import { requirePortalUser } from '@/lib/bookingCustomer'
import { addDays, dateKey, formatDateTime, todayWall } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { formatCents } from '@/lib/money'
import { bookingServices, customerRescheduleAvailability } from '@/lib/ops/bookings'

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
  return (
    <div>
      <Link href="/portal" className="text-sm font-semibold text-emerald-700">
        ← My appointments
      </Link>
      <h1 className="mt-5 text-3xl font-bold">{booking.business.name}</h1>
      {query.created || query.updated ? (
        <p role="status" className="mt-4 rounded-xl bg-emerald-100 p-4 text-sm font-medium">
          {query.created
            ? booking.status === 'PENDING'
              ? 'Your request is saved. The detailer will confirm it after reviewing availability.'
              : booking.status === 'CONFIRMED'
                ? 'Your appointment is confirmed.'
                : 'This booking has already changed. See its current status below.'
            : 'Your appointment has been updated.'}
        </p>
      ) : null}
      <div className="mt-6 grid gap-6 md:grid-cols-2">
        <section className="rounded-2xl border border-emerald-900/10 bg-white p-6">
          <p className="text-xs font-semibold uppercase text-emerald-700">
            {booking.job?.status === 'COMPLETED'
              ? 'Completed'
              : booking.status === 'PENDING'
                ? 'Awaiting detailer approval'
                : booking.status.toLowerCase()}
          </p>
          <h2 className="mt-3 text-xl font-bold">
            {formatDateTime(booking.scheduledAt, settings.timezone)}
          </h2>
          <p className="mt-1 text-xs text-slate-500">{settings.timezone}</p>
          <p className="mt-5 font-semibold">
            {bookingServices(booking.serviceSnapshots)
              .map((service) => service.name)
              .join(' + ')}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {booking.vehicle.year} {booking.vehicle.make} {booking.vehicle.model}
          </p>
          <p className="mt-5 whitespace-pre-wrap text-sm">{booking.address}</p>
          {booking.waterPowerNotes ? (
            <p className="mt-3 text-sm text-slate-600">Access: {booking.waterPowerNotes}</p>
          ) : null}
          {booking.customerNotes ? (
            <p className="mt-3 text-sm text-slate-600">Your note: {booking.customerNotes}</p>
          ) : null}
          <p className="mt-5 text-xl font-bold">{formatCents(booking.priceCents)}</p>
          <p className="mt-1 text-xs text-slate-500">Payment arranged with your detailer.</p>
          {booking.job?.invoiceNumber ? (
            <Link className={`${bookingButton} mt-5`} href={`/portal/invoices/${booking.job.id}`}>
              View invoice #{booking.job.invoiceNumber}
            </Link>
          ) : null}
          {settings.phone ? <p className="mt-5 text-sm">Questions? {settings.phone}</p> : null}
        </section>
        {changeable ? (
          <section className="rounded-2xl border border-emerald-900/10 bg-white p-6">
            <h2 className="text-lg font-semibold">Need another time?</h2>
            <p className="mt-1 text-sm text-slate-500">
              Changes require {settings.cancellationHours} hours notice.
            </p>
            <form method="get" className="my-4 flex flex-wrap items-end gap-2">
              <Field label="Choose a day">
                <input
                  className={bookingInput}
                  type="date"
                  name="day"
                  defaultValue={day}
                  min={dateKey(todayWall(settings.timezone))}
                  max={dateKey(addDays(todayWall(settings.timezone), settings.horizonDays))}
                />
              </Field>
              <button type="submit" className={bookingButton}>
                Find times
              </button>
            </form>
            {slots.length ? (
              <BookingActionForm action={changeBookingAction} label="Move appointment">
                <input name="id" type="hidden" value={booking.id} />
                <input name="intent" type="hidden" value="reschedule" />
                <Field label="Available time">
                  <select className={bookingInput} name="scheduledAt" required defaultValue="">
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
                <p className="text-xs text-slate-500">
                  An already confirmed appointment stays confirmed when you move it to an available
                  time.
                </p>
              </BookingActionForm>
            ) : (
              <p className="rounded-xl bg-emerald-50 p-3 text-sm">
                No available times on this day. Try another day.
              </p>
            )}
            <div className="mt-6 border-t border-emerald-900/10 pt-5">
              <BookingActionForm action={changeBookingAction} label="Cancel appointment" danger>
                <input name="id" type="hidden" value={booking.id} />
                <input name="intent" type="hidden" value="cancel" />
                <label className="flex items-start gap-2 text-sm text-slate-600">
                  <input type="checkbox" required className="mt-1" />I want to cancel this
                  appointment.
                </label>
              </BookingActionForm>
            </div>
          </section>
        ) : (
          <section className="rounded-2xl border border-emerald-900/10 bg-white p-6">
            <h2 className="font-semibold">Your next clean</h2>
            <p className="mt-2 text-sm text-slate-500">
              {['PENDING', 'CONFIRMED'].includes(booking.status)
                ? 'This appointment can no longer be changed online. Contact your detailer for help.'
                : 'Ready for another detail? Choose a new appointment.'}
            </p>
            {booking.business.status === 'PUBLISHED' ? (
              <Link className={`${bookingButton} mt-5`} href={`/b/${booking.business.slug}`}>
                Book again →
              </Link>
            ) : null}
          </section>
        )}
      </div>
    </div>
  )
}
