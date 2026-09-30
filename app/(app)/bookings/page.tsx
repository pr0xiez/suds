import Link from 'next/link'
import { decideBookingAction } from '@/app/actions/bookings'
import { Card, EmptyState, PageHeader } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { formatDateTime } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { formatCents } from '@/lib/money'
import { bookingServices } from '@/lib/ops/bookings'
import { getSettings } from '@/lib/ops/settings'

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
          <Link href="/onboarding" className="text-sm font-semibold text-emerald-700">
            Booking settings →
          </Link>
        }
      />
      {query.error ? (
        <p role="alert" className="mb-5 rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
          {query.error}
        </p>
      ) : null}
      <Card title={`Requests to review (${pending.length})`}>
        <p className="mb-4 text-xs text-slate-500">
          A request does not reserve time. Suds checks the full service and travel buffer again when
          you accept it.
        </p>
        {!pending.length ? (
          <EmptyState
            title="You’re all caught up"
            hint="New requests appear here when approval booking is enabled."
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {pending.map((booking) => (
              <article key={booking.id} className="rounded-xl border border-slate-200 p-4">
                <p className="text-xs font-semibold uppercase text-emerald-700">
                  Awaiting approval
                </p>
                <h2 className="mt-2 font-semibold">{booking.customer.name}</h2>
                <p className="mt-1 text-sm">
                  {formatDateTime(booking.scheduledAt, settings.timezone)}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {bookingServices(booking.serviceSnapshots)
                    .map((service) => service.name)
                    .join(' + ')}{' '}
                  · {formatCents(booking.priceCents)}
                </p>
                <p className="mt-2 text-sm">
                  {booking.vehicle.make} {booking.vehicle.model}
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">{booking.address}</p>
                {booking.waterPowerNotes ? (
                  <p className="mt-2 text-sm text-slate-500">Access: {booking.waterPowerNotes}</p>
                ) : null}
                {booking.customerNotes ? (
                  <p className="mt-2 text-sm text-slate-500">Note: {booking.customerNotes}</p>
                ) : null}
                <p className="mt-2 text-sm text-slate-500">
                  {booking.customer.phone} · {booking.customer.email}
                </p>
                {user.businessRole === 'OWNER' ? (
                  <div className="mt-4 flex gap-2">
                    <form action={decideBookingAction}>
                      <input name="id" type="hidden" value={booking.id} />
                      <button
                        type="submit"
                        name="decision"
                        value="accept"
                        className="rounded-xl bg-emerald-900 px-4 py-3 text-sm font-semibold text-white"
                      >
                        Accept
                      </button>
                    </form>
                    <form action={decideBookingAction}>
                      <input name="id" type="hidden" value={booking.id} />
                      <button
                        type="submit"
                        name="decision"
                        value="decline"
                        className="rounded-xl border border-rose-200 px-4 py-3 text-sm font-semibold text-rose-700"
                      >
                        Decline
                      </button>
                    </form>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-slate-500">
                    The business owner can accept or decline.
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </Card>
      <div className="mt-6">
        <Card title="Other customer bookings">
          {!recent.length ? (
            <EmptyState title="No customer bookings yet" />
          ) : (
            <div className="divide-y divide-slate-100">
              {recent.map((booking) => (
                <div
                  key={booking.id}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">{booking.customer.name}</p>
                    <p className="text-slate-500">
                      {formatDateTime(booking.scheduledAt, settings.timezone)} ·{' '}
                      {booking.status.toLowerCase()}
                    </p>
                  </div>
                  {booking.jobId ? (
                    <Link
                      className="font-semibold text-emerald-700"
                      href={`/jobs/${booking.jobId}`}
                    >
                      Open job →
                    </Link>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
