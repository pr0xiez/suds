import Link from 'next/link'
import { requirePortalUser } from '@/lib/bookingCustomer'
import { formatDateTime } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { formatCents } from '@/lib/money'
import { bookingServices } from '@/lib/ops/bookings'

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
    <div>
      <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
        Your detailing, organized
      </p>
      <h1 className="mt-2 text-3xl font-bold">My appointments</h1>
      <p className="mt-2 text-sm text-slate-600">
        See what’s booked, request changes and find your invoices.
      </p>
      {customers.length ? (
        <div className="mt-5 flex flex-wrap gap-2">
          {customers.map((customer) => (
            <Link
              className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white"
              key={customer.id}
              href={`/b/${customer.business.slug}`}
            >
              Book {customer.business.name} again →
            </Link>
          ))}
        </div>
      ) : null}
      {!bookings.length && !otherJobs.length ? (
        <section className="mt-6 rounded-2xl border border-dashed border-emerald-900/20 bg-white p-8">
          <h2 className="font-semibold">Your first clean starts here.</h2>
          <p className="mt-2 max-w-lg text-sm text-slate-500">
            Open your detailer’s booking link to choose a service and time. If you already have an
            appointment, ask the detailer for a customer invitation to securely connect it to your
            account.
          </p>
        </section>
      ) : null}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {bookings.map((booking) => (
          <Link
            key={booking.id}
            href={`/portal/appointments/${booking.id}`}
            className="rounded-2xl border border-emerald-900/10 bg-white p-5 transition hover:border-emerald-700"
          >
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold">
              {booking.job?.status === 'COMPLETED'
                ? 'Completed'
                : booking.status === 'PENDING'
                  ? 'Awaiting approval'
                  : booking.status.toLowerCase()}
            </span>
            <h2 className="mt-4 text-lg font-semibold">{booking.business.name}</h2>
            <p className="mt-1 text-sm">
              {formatDateTime(booking.scheduledAt, booking.business.settings?.timezone ?? 'UTC')}
            </p>
            <p className="mt-2 text-sm text-slate-500">
              {bookingServices(booking.serviceSnapshots)
                .map((service) => service.name)
                .join(' + ')}{' '}
              · {booking.vehicle.make} {booking.vehicle.model}
            </p>
            <p className="mt-4 text-sm font-semibold">
              {formatCents(booking.priceCents)}{' '}
              <span className="float-right">View appointment →</span>
            </p>
          </Link>
        ))}
      </div>
      {otherJobs.length ? (
        <section className="mt-8">
          <h2 className="mb-4 text-lg font-semibold">Appointments arranged with your detailer</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {otherJobs.map((job) => (
              <article
                key={job.id}
                className="rounded-2xl border border-emerald-900/10 bg-white p-5"
              >
                <p className="text-xs font-semibold uppercase text-emerald-700">
                  {job.status.replaceAll('_', ' ')}
                </p>
                <h3 className="mt-2 font-semibold">{job.business.name}</h3>
                <p className="mt-1 text-sm">
                  {formatDateTime(job.scheduledAt, job.business.settings?.timezone ?? 'UTC')}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {job.vehicle.make} {job.vehicle.model}
                </p>
                {job.invoiceNumber ? (
                  <Link
                    className="mt-4 inline-block text-sm font-semibold underline"
                    href={`/portal/invoices/${job.id}`}
                  >
                    View invoice #{job.invoiceNumber}
                  </Link>
                ) : (
                  <p className="mt-4 text-xs text-slate-500">
                    Contact the detailer to change this appointment.
                  </p>
                )}
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}
