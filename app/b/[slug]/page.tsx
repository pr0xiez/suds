import { randomUUID } from 'node:crypto'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PublicBookingForm } from '@/components/PublicBookingForm'
import { getSessionUser } from '@/lib/auth/session'
import { bookingTimeLabel } from '@/lib/bookingAvailability'
import { addDays, dateKey, minutesToHuman, parseDateKey, todayWall } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { formatCents } from '@/lib/money'
import { publicAvailability, publicBusiness } from '@/lib/ops/bookings'

export const dynamic = 'force-dynamic'

export default async function BusinessBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ serviceId?: string; day?: string; time?: string }>
}) {
  const { slug } = await params
  const business = await publicBusiness(slug)
  if (!business?.settings) notFound()
  const settings = business.settings
  const query = await searchParams
  const service =
    business.services.find((item) => item.id === query.serviceId) ?? business.services[0]
  const today = todayWall(settings.timezone)
  const parsedDay = typeof query.day === 'string' ? parseDateKey(query.day) : null
  const day =
    parsedDay && query.day && dateKey(addDays(parsedDay, 0)) === query.day
      ? query.day
      : dateKey(today)
  const wall = parseDateKey(day) ?? today
  const [user, slots] = await Promise.all([
    getSessionUser(),
    service ? publicAvailability(business.id, day, [service.id]) : Promise.resolve([]),
  ])
  const customer = user
    ? await prisma.customer.findFirst({
        where: { businessId: business.id, userId: user.id },
        select: {
          phone: true,
          address: true,
          vehicles: { select: { id: true, year: true, make: true, model: true } },
        },
      })
    : null
  const selectedTime = slots.find((slot) => slot.toISOString() === query.time)?.toISOString()
  const returnPath = `/b/${business.slug}?${new URLSearchParams({ serviceId: service?.id ?? '', day, ...(selectedTime ? { time: selectedTime } : {}) })}`
  const button =
    'inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-900 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800'
  return (
    <div className="min-h-dvh bg-[#f6f8f2] text-emerald-950">
      <header className="border-b border-emerald-900/10 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-5">
          <Link href={returnPath} className="text-lg font-bold">
            {business.name}
          </Link>
          <Link href="/portal" className="text-sm font-semibold">
            My appointments →
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:py-12">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-700">
          Mobile detailing · powered by Suds
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          A fresh start for your vehicle.
        </h1>
        <p className="mt-3 max-w-xl text-base text-slate-600">
          Choose your detail, find a time, and we’ll come to you.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm">
          <span className="rounded-full border border-emerald-900/10 bg-white px-4 py-2">
            Serving {business.serviceArea}
          </span>
          <span className="rounded-full border border-emerald-900/10 bg-white px-4 py-2">
            {settings.bookingMode === 'INSTANT' ? 'Instant confirmation' : 'Owner approval'}
          </span>
        </div>
        <div className="mt-8 grid items-start gap-6 md:grid-cols-[.8fr_1.2fr]">
          <section className="rounded-2xl border border-emerald-900/10 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold">1. Choose your detail</h2>
            <form className="mt-4 space-y-3" method="get">
              <input name="day" type="hidden" value={day} />
              {business.services.map((item) => (
                <label
                  key={item.id}
                  className="block cursor-pointer rounded-xl border border-emerald-900/10 p-4 has-checked:border-emerald-700 has-checked:bg-emerald-50"
                >
                  <span className="flex items-start gap-2">
                    <input
                      type="radio"
                      name="serviceId"
                      value={item.id}
                      defaultChecked={service?.id === item.id}
                      className="mt-1 accent-emerald-800"
                    />
                    <span className="flex-1">
                      <span className="block font-semibold">{item.name}</span>
                      <span className="mt-1 block text-sm text-slate-500">{item.description}</span>
                      <span className="mt-2 block text-sm font-medium">
                        {formatCents(item.priceCents)} · {minutesToHuman(item.durationMin)}
                      </span>
                    </span>
                  </span>
                </label>
              ))}
              <button type="submit" className={button}>
                See available times
              </button>
            </form>
            <div className="mt-6 border-t border-emerald-900/10 pt-4 text-sm text-slate-600">
              <p>Changes need {settings.cancellationHours} hours notice.</p>
              <p className="mt-2">
                A {settings.travelBufferMin}-minute travel buffer keeps appointments on time.
              </p>
              {settings.phone ? <p className="mt-2">Questions? {settings.phone}</p> : null}
            </div>
          </section>
          <section className="rounded-2xl border border-emerald-900/10 bg-white p-5 sm:p-6">
            <h2 className="text-lg font-semibold">2. Choose a day and time</h2>
            <p className="mt-1 text-sm text-slate-500">All times in {settings.timezone}.</p>
            <form method="get" className="my-4 flex flex-wrap items-end gap-2">
              <input name="serviceId" type="hidden" value={service?.id ?? ''} />
              <label className="flex-1 text-xs font-semibold uppercase text-slate-500">
                Day
                <input
                  type="date"
                  name="day"
                  defaultValue={day}
                  min={dateKey(today)}
                  max={dateKey(addDays(today, settings.horizonDays))}
                  className="mt-1 block w-full rounded-xl border border-emerald-900/15 px-3 py-3 text-sm text-slate-900"
                />
              </label>
              <button type="submit" className={button}>
                Find times
              </button>
            </form>
            {!service ? (
              <p className="rounded-xl bg-emerald-50 p-4 text-sm">
                The detailer is updating their service menu. Please check back soon.
              </p>
            ) : slots.length === 0 ? (
              <div className="rounded-xl bg-emerald-50 p-4">
                <p className="text-sm">No times fit this service on this day.</p>
                <Link
                  className="mt-3 inline-block text-sm font-semibold underline"
                  href={`/b/${business.slug}?${new URLSearchParams({ serviceId: service.id, day: dateKey(addDays(wall, 1)) })}`}
                >
                  Try the next day →
                </Link>
              </div>
            ) : user?.emailVerifiedAt ? (
              <PublicBookingForm
                slug={business.slug}
                serviceId={service.id}
                slots={slots.map((slot) => ({
                  value: slot.toISOString(),
                  label: bookingTimeLabel(slot, settings.timezone),
                }))}
                request={settings.bookingMode === 'REQUEST'}
                idempotencyKey={randomUUID()}
                vehicles={(customer?.vehicles ?? []).map((vehicle) => ({
                  id: vehicle.id,
                  label: `${vehicle.year ?? ''} ${vehicle.make} ${vehicle.model}`.trim(),
                }))}
                phone={customer?.phone ?? ''}
                address={customer?.address ?? ''}
                selectedTime={selectedTime}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {slots.map((slot) => (
                    <Link
                      key={slot.toISOString()}
                      href={`/b/${business.slug}?${new URLSearchParams({ serviceId: service.id, day, time: slot.toISOString() })}`}
                      aria-current={selectedTime === slot.toISOString() ? 'true' : undefined}
                      className={`rounded-lg border px-3 py-2 text-sm ${selectedTime === slot.toISOString() ? 'border-emerald-700 bg-emerald-50 font-semibold' : 'border-emerald-900/10 hover:bg-emerald-50'}`}
                    >
                      {bookingTimeLabel(slot, settings.timezone)}
                    </Link>
                  ))}
                </div>
                {selectedTime ? (
                  <p className="text-sm font-semibold">
                    Selected: {bookingTimeLabel(new Date(selectedTime), settings.timezone)}. This
                    time is reserved when your booking is confirmed.
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">
                    Select a time to carry it into your customer account.
                  </p>
                )}
                <p className="text-sm text-slate-600">
                  {user
                    ? 'Verify your email to confirm your appointment.'
                    : 'Create your customer account or sign in to confirm a time and manage your appointments.'}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    className={button}
                    href={
                      user
                        ? `/verify?next=${encodeURIComponent(returnPath)}`
                        : `/signup?kind=CUSTOMER&next=${encodeURIComponent(returnPath)}`
                    }
                  >
                    {user ? 'Verify email' : 'Create customer account'}
                  </Link>
                  {!user ? (
                    <Link
                      className="rounded-xl border border-emerald-900/15 px-5 py-3 text-sm font-semibold"
                      href={`/login?next=${encodeURIComponent(returnPath)}`}
                    >
                      Sign in
                    </Link>
                  ) : null}
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  )
}
