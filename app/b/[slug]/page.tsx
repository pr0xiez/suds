import { randomUUID } from 'node:crypto'
import {
  ArrowRightIcon,
  CalendarCheckIcon,
  CalendarXIcon,
  CarProfileIcon,
  ClockCounterClockwiseIcon,
  ClockIcon,
  LightningIcon,
  MapPinIcon,
  PhoneIcon,
  UserCircleIcon,
  WrenchIcon,
} from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { bookingButton, bookingInput } from '@/components/bookingStyles'
import { LogoMark } from '@/components/Logo'
import { PublicBookingForm } from '@/components/PublicBookingForm'
import { btnSecondary, EmptyState, labelClass } from '@/components/ui'
import { getSessionUser } from '@/lib/auth/session'
import { bookingTimeLabel } from '@/lib/bookingAvailability'
import { addDays, dateKey, minutesToHuman, parseDateKey, todayWall } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { formatCents } from '@/lib/money'
import { publicAvailability, publicBusiness } from '@/lib/ops/bookings'

export const dynamic = 'force-dynamic'

/** Roomier secondary action, sized to sit beside the customer-facing controls. */
const secondaryButton = clsx(btnSecondary, 'min-h-11! px-5!')

/** Time pills: the same grid signed in (radios) and signed out (links). */
const slotPill =
  'flex min-h-11 items-center justify-center rounded-control border px-2 text-sm font-medium tabular-nums transition-colors'
const slotIdle =
  'border-line-strong/60 bg-surface text-ink hover:border-ink-faint hover:bg-surface-2'
const slotActive = 'border-primary bg-primary text-on-primary'

const panel = 'min-w-0 rounded-panel border border-line bg-surface shadow-panel'

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
  const instant = settings.bookingMode === 'INSTANT'
  return (
    <div className="flex min-h-dvh flex-col bg-canvas text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href={returnPath}
            className="min-w-0 truncate font-display text-base font-bold text-ink"
          >
            {business.name}
          </Link>
          <Link
            href="/portal"
            className="inline-flex min-h-10 shrink-0 items-center gap-1.5 text-sm font-medium text-ink-muted transition-colors hover:text-ink"
          >
            <CalendarCheckIcon aria-hidden className="size-4" />
            My appointments
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-10 pb-16 sm:px-6 sm:pt-14">
        <section aria-labelledby="booking-title" className="max-w-2xl animate-rise">
          <p className="text-sm text-ink-muted">Mobile detailing by {business.name}</p>
          <h1
            id="booking-title"
            className="mt-3 font-display text-[2.4rem] font-bold leading-[1.05] text-balance sm:text-5xl"
          >
            A fresh start for your vehicle.
          </h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">
            Choose your detail, find a time, and we’ll come to you.
          </p>
          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2.5 text-sm text-ink">
            <li className="flex min-w-0 items-center gap-2">
              <MapPinIcon aria-hidden className="size-4.5 shrink-0 text-accent-ink" />
              <span className="min-w-0">Serving {business.serviceArea}</span>
            </li>
            <li className="flex items-center gap-2">
              {instant ? (
                <LightningIcon aria-hidden className="size-4.5 shrink-0 text-accent-ink" />
              ) : (
                <ClockIcon aria-hidden className="size-4.5 shrink-0 text-accent-ink" />
              )}
              {instant ? 'Instant confirmation' : 'Owner approval'}
            </li>
          </ul>
        </section>

        <div className="mt-10 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:grid-rows-[auto_1fr]">
          <section aria-labelledby="choose-service" className={clsx(panel, 'p-5 sm:p-6')}>
            <h2 id="choose-service" className="font-display text-xl font-bold">
              Choose your detail
            </h2>
            <form className="mt-5 space-y-3" method="get">
              <input name="day" type="hidden" value={day} />
              {business.services.map((item) => (
                <label
                  key={item.id}
                  className="flex cursor-pointer items-start gap-3 rounded-control border border-line bg-surface p-4 transition-colors hover:border-line-strong has-checked:border-accent-line has-checked:bg-accent-soft has-focus-visible:ring-3 has-focus-visible:ring-focus/25"
                >
                  <input
                    type="radio"
                    name="serviceId"
                    value={item.id}
                    defaultChecked={service?.id === item.id}
                    className="mt-0.5 size-4 shrink-0 focus-visible:outline-none"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 font-semibold text-ink">{item.name}</span>
                      <span className="shrink-0 font-semibold tabular-nums text-ink">
                        {formatCents(item.priceCents)}
                      </span>
                    </span>
                    {item.description ? (
                      <span className="mt-1 block text-sm leading-relaxed text-ink-muted">
                        {item.description}
                      </span>
                    ) : null}
                    <span className="mt-2 flex items-center gap-1.5 text-sm tabular-nums text-ink-muted">
                      <ClockIcon aria-hidden className="size-4 shrink-0" />
                      {minutesToHuman(item.durationMin)}
                    </span>
                  </span>
                </label>
              ))}
              <div className="pt-2">
                <button type="submit" className={clsx(secondaryButton, 'w-full')}>
                  See available times
                </button>
              </div>
            </form>
          </section>

          <section
            aria-labelledby="choose-time"
            className={clsx(panel, 'p-5 sm:p-6 lg:col-start-2 lg:row-span-2 lg:row-start-1')}
          >
            <h2 id="choose-time" className="font-display text-xl font-bold">
              Choose a day and time
            </h2>
            <p className="mt-1.5 text-sm text-ink-muted">All times in {settings.timezone}.</p>
            <form method="get" className="mt-5 flex items-end gap-2">
              <input name="serviceId" type="hidden" value={service?.id ?? ''} />
              <label className="block min-w-0 flex-1">
                <span className={labelClass}>Day</span>
                <input
                  type="date"
                  name="day"
                  defaultValue={day}
                  min={dateKey(today)}
                  max={dateKey(addDays(today, settings.horizonDays))}
                  className={bookingInput}
                />
              </label>
              <button type="submit" className={clsx(secondaryButton, 'shrink-0')}>
                Find times
              </button>
            </form>
            <div className="mt-6 border-t border-line pt-6">
              {!service ? (
                <EmptyState
                  icon={WrenchIcon}
                  title="The detailer is updating their service menu."
                  hint="Please check back soon."
                />
              ) : slots.length === 0 ? (
                <EmptyState
                  icon={CalendarXIcon}
                  title="No times fit this service on this day."
                  action={
                    <Link
                      className={secondaryButton}
                      href={`/b/${business.slug}?${new URLSearchParams({ serviceId: service.id, day: dateKey(addDays(wall, 1)) })}`}
                    >
                      Try the next day
                      <ArrowRightIcon aria-hidden />
                    </Link>
                  }
                />
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
                <div className="space-y-5">
                  <div>
                    <p className="mb-3 text-sm font-medium text-ink">Choose your time</p>
                    <div className="-m-1 grid max-h-80 grid-cols-2 gap-2 overflow-y-auto p-1 sm:grid-cols-3">
                      {slots.map((slot) => (
                        <Link
                          key={slot.toISOString()}
                          href={`/b/${business.slug}?${new URLSearchParams({ serviceId: service.id, day, time: slot.toISOString() })}`}
                          aria-current={selectedTime === slot.toISOString() ? 'true' : undefined}
                          className={clsx(
                            slotPill,
                            selectedTime === slot.toISOString() ? slotActive : slotIdle,
                          )}
                        >
                          {bookingTimeLabel(slot, settings.timezone)}
                        </Link>
                      ))}
                    </div>
                    {selectedTime ? (
                      <p className="mt-3 text-sm text-ink">
                        <span className="font-semibold">
                          Selected: {bookingTimeLabel(new Date(selectedTime), settings.timezone)}.
                        </span>{' '}
                        <span className="text-ink-muted">
                          This time is reserved when your booking is confirmed.
                        </span>
                      </p>
                    ) : (
                      <p className="mt-3 text-sm text-ink-muted">
                        Select a time to carry it into your customer account.
                      </p>
                    )}
                  </div>
                  <div className="rounded-panel border border-line bg-surface-2 p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <UserCircleIcon aria-hidden className="size-6 shrink-0 text-accent-ink" />
                      <div className="min-w-0">
                        <p className="font-semibold text-ink">
                          {user
                            ? 'One step left: verify your email'
                            : 'Book with your customer account'}
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-ink-muted">
                          {user
                            ? 'Verify your email to confirm your appointment.'
                            : 'Create your customer account or sign in to confirm a time and manage your appointments.'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                      <Link
                        className={bookingButton}
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
                          className={secondaryButton}
                          href={`/login?next=${encodeURIComponent(returnPath)}`}
                        >
                          Sign in
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section
            aria-label="Booking policies"
            className="min-w-0 px-1 lg:col-start-1 lg:row-start-2"
          >
            <ul className="space-y-3 text-sm text-ink-muted">
              <li className="flex items-start gap-3">
                <ClockCounterClockwiseIcon
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-ink-faint"
                />
                <span className="min-w-0">
                  Changes need {settings.cancellationHours} hours notice.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <CarProfileIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-faint" />
                <span className="min-w-0">
                  A {settings.travelBufferMin}-minute travel buffer keeps appointments on time.
                </span>
              </li>
              {settings.phone ? (
                <li className="flex items-start gap-3">
                  <PhoneIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-faint" />
                  <span className="min-w-0">
                    Questions?{' '}
                    <span className="font-medium tabular-nums text-ink">{settings.phone}</span>
                  </span>
                </li>
              ) : null}
            </ul>
          </section>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-10 sm:px-6">
        <p className="flex items-center gap-2 border-t border-line pt-6 text-sm text-ink-faint">
          <LogoMark className="size-4" />
          Booking powered by Suds
        </p>
      </footer>
    </div>
  )
}
