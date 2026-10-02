import { ArrowRightIcon, CalendarBlankIcon, CalendarPlusIcon } from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import Link from 'next/link'
import {
  Badge,
  btnSecondary,
  EmptyState,
  JobStatusBadge,
  linkClass,
  PageHeader,
  type Tone,
} from '@/components/ui'
import { requirePortalUser } from '@/lib/bookingCustomer'
import { formatDate, formatTime } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { formatCents } from '@/lib/money'
import { bookingServices } from '@/lib/ops/bookings'

/** Same states as before, now labelled in sentence case with a status tone. */
function bookingBadge(status: string, jobStatus: string | undefined): [string, Tone] {
  if (jobStatus === 'COMPLETED') return ['Completed', 'ok']
  if (status === 'PENDING') return ['Awaiting approval', 'warn']
  const label = status.toLowerCase()
  const text = `${label.charAt(0).toUpperCase()}${label.slice(1)}`
  if (status === 'CONFIRMED') return [text, 'info']
  if (status === 'DECLINED') return [text, 'danger']
  return [text, 'neutral']
}

export default async function PortalPage() {
  const user = await requirePortalUser()
  const [bookings, otherJobs, customers] = await Promise.all([
    prisma.booking.findMany({
      where: { customer: { userId: user.id } },
      orderBy: { scheduledAt: 'desc' },
      take: 100,
      select: {
        id: true,
        status: true,
        scheduledAt: true,
        priceCents: true,
        serviceSnapshots: true,
        vehicle: { select: { make: true, model: true } },
        job: { select: { status: true } },
        business: { select: { name: true, settings: { select: { timezone: true } } } },
      },
    }),
    prisma.job.findMany({
      where: { customer: { userId: user.id }, booking: null },
      orderBy: { scheduledAt: 'desc' },
      take: 50,
      select: {
        id: true,
        scheduledAt: true,
        status: true,
        invoiceNumber: true,
        vehicle: { select: { make: true, model: true } },
        business: { select: { name: true, settings: { select: { timezone: true } } } },
      },
    }),
    prisma.customer.findMany({
      where: { userId: user.id, business: { status: 'PUBLISHED' } },
      select: { id: true, business: { select: { slug: true, name: true } } },
    }),
  ])
  return (
    <div data-portal-section="appointments">
      <PageHeader
        title="My appointments"
        subtitle="See what’s booked, request changes and find your invoices."
        actions={
          customers.length
            ? customers.map((customer) => (
                <Link
                  className={clsx(btnSecondary, 'max-w-full whitespace-normal! text-left')}
                  key={customer.id}
                  href={`/b/${customer.business.slug}`}
                >
                  <CalendarPlusIcon aria-hidden />
                  Book {customer.business.name} again
                </Link>
              ))
            : undefined
        }
      />
      {!bookings.length && !otherJobs.length ? (
        <EmptyState
          icon={CalendarBlankIcon}
          title="Your first clean starts here."
          hint="Open your detailer’s booking link to choose a service and time. If you already have an appointment, ask the detailer for a customer invitation to securely connect it to your account."
        />
      ) : null}
      {bookings.length ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {bookings.map((booking) => {
            const tz = booking.business.settings?.timezone ?? 'UTC'
            const [label, tone] = bookingBadge(booking.status, booking.job?.status)
            return (
              <li key={booking.id} className="min-w-0">
                <Link
                  href={`/portal/appointments/${booking.id}`}
                  className="group flex h-full flex-col rounded-panel border border-line bg-surface p-5 shadow-panel transition-colors hover:border-line-strong"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-lg font-semibold leading-snug text-ink">
                        {formatDate(booking.scheduledAt, tz)}
                      </span>
                      <span className="mt-0.5 block text-sm font-medium tabular-nums text-ink-muted">
                        {formatTime(booking.scheduledAt, tz)}
                      </span>
                    </span>
                    <Badge tone={tone}>{label}</Badge>
                  </span>
                  <span className="mt-4 block font-semibold text-ink">{booking.business.name}</span>
                  <span className="mt-1 mb-4 block text-sm text-ink-muted">
                    {bookingServices(booking.serviceSnapshots)
                      .map((service) => service.name)
                      .join(' + ')}{' '}
                    · {booking.vehicle.make} {booking.vehicle.model}
                  </span>
                  <span className="mt-auto flex items-center justify-between gap-3 border-t border-line pt-4 text-sm">
                    <span className="font-semibold tabular-nums text-ink">
                      {formatCents(booking.priceCents)}
                    </span>
                    <span className="inline-flex items-center gap-1 font-medium text-accent-ink group-hover:underline">
                      View appointment
                      <ArrowRightIcon aria-hidden className="size-3.5" />
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      ) : null}
      {otherJobs.length ? (
        <section className="mt-10">
          <h2 className="text-base font-semibold text-ink">
            Appointments arranged with your detailer
          </h2>
          <ul className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {otherJobs.map((job) => (
              <li
                key={job.id}
                className="flex min-w-0 flex-col rounded-panel border border-line bg-surface p-5 shadow-panel"
              >
                <span className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block text-lg font-semibold leading-snug text-ink">
                      {formatDate(job.scheduledAt, job.business.settings?.timezone ?? 'UTC')}
                    </span>
                    <span className="mt-0.5 block text-sm font-medium tabular-nums text-ink-muted">
                      {formatTime(job.scheduledAt, job.business.settings?.timezone ?? 'UTC')}
                    </span>
                  </span>
                  <JobStatusBadge status={job.status} />
                </span>
                <h3 className="mt-4 font-semibold text-ink">{job.business.name}</h3>
                <p className="mt-1 mb-4 text-sm text-ink-muted">
                  {job.vehicle.make} {job.vehicle.model}
                </p>
                <div className="mt-auto border-t border-line pt-4 text-sm">
                  {job.invoiceNumber ? (
                    <Link className={linkClass} href={`/portal/invoices/${job.id}`}>
                      View invoice #{job.invoiceNumber}
                    </Link>
                  ) : (
                    <p className="text-ink-muted">
                      Contact the detailer to change this appointment.
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}
