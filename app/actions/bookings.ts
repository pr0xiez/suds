'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireOwner } from '@/lib/auth/session'
import { parseBookingInstant } from '@/lib/bookingAvailability'
import { requirePortalUser } from '@/lib/bookingCustomer'
import { lockBusinessSchedule } from '@/lib/bookingSchedule'
import { parseDatetimeLocal, toDatetimeLocalValue } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { fdString, friendlyError } from '@/lib/forms'
import {
  changeCustomerBooking,
  createAvailabilityBlock,
  decideBooking,
  saveBookingSetup,
  submitPublicBooking,
} from '@/lib/ops/bookings'
import { getSettings } from '@/lib/ops/settings'

export interface BookingFormState {
  error: string
}

export async function bookAppointmentAction(
  _previous: BookingFormState,
  fd: FormData,
): Promise<BookingFormState> {
  const slug = fdString(fd, 'slug')
  const user = await requirePortalUser(`/b/${encodeURIComponent(slug)}`)
  let id: string
  try {
    const year = fdString(fd, 'year')
    const booking = await submitPublicBooking(user.id, {
      slug,
      serviceIds: fd
        .getAll('serviceId')
        .filter((value): value is string => typeof value === 'string'),
      scheduledAt: fdString(fd, 'scheduledAt'),
      idempotencyKey: fdString(fd, 'idempotencyKey'),
      vehicleId: fdString(fd, 'vehicleId') || undefined,
      make: fdString(fd, 'make'),
      model: fdString(fd, 'model'),
      year: year ? Number(year) : null,
      address: fdString(fd, 'address'),
      phone: fdString(fd, 'phone'),
      waterPowerNotes: fdString(fd, 'waterPowerNotes'),
      customerNotes: fdString(fd, 'customerNotes'),
    })
    id = booking.id
  } catch (error) {
    return { error: friendlyError(error) }
  }
  revalidatePath('/', 'layout')
  redirect(`/portal/appointments/${id}?created=1`)
}

export async function decideBookingAction(fd: FormData): Promise<void> {
  const user = await requireOwner()
  let error = ''
  try {
    await decideBooking(user.businessId, fdString(fd, 'id'), fdString(fd, 'decision') === 'accept')
  } catch (err) {
    error = friendlyError(err)
  }
  revalidatePath('/', 'layout')
  redirect(error ? `/bookings?error=${encodeURIComponent(error)}` : '/bookings')
}

export async function changeBookingAction(
  _previous: BookingFormState,
  fd: FormData,
): Promise<BookingFormState> {
  const id = fdString(fd, 'id')
  const user = await requirePortalUser(`/portal/appointments/${encodeURIComponent(id)}`)
  try {
    const time = parseBookingInstant(fdString(fd, 'scheduledAt'))
    if (fdString(fd, 'intent') !== 'cancel' && !time) throw new Error('Choose an available time')
    await changeCustomerBooking(user.id, id, fdString(fd, 'intent') === 'cancel' ? null : time)
  } catch (error) {
    return { error: friendlyError(error) }
  }
  revalidatePath('/', 'layout')
  redirect(`/portal/appointments/${encodeURIComponent(id)}?updated=1`)
}

export async function saveBookingSetupAction(
  _previous: BookingFormState,
  fd: FormData,
): Promise<BookingFormState> {
  const user = await requireOwner()
  try {
    const workingHours = []
    for (let day = 0; day < 7; day++) {
      if (!fd.has(`open-${day}`)) continue
      workingHours.push({
        day,
        start: fdString(fd, `start-${day}`),
        end: fdString(fd, `end-${day}`),
      })
      if (fd.has(`split-${day}`))
        workingHours.push({
          day,
          start: fdString(fd, `second-start-${day}`),
          end: fdString(fd, `second-end-${day}`),
        })
    }
    await saveBookingSetup(user.businessId, {
      name: fdString(fd, 'name'),
      slug: fdString(fd, 'slug'),
      serviceArea: fdString(fd, 'serviceArea'),
      timezone: fdString(fd, 'timezone'),
      bookingMode: fdString(fd, 'bookingMode') === 'REQUEST' ? 'REQUEST' : 'INSTANT',
      workingHours,
      travelBufferMin: Number(fdString(fd, 'travelBufferMin')),
      leadTimeMin: Number(fdString(fd, 'leadTimeMin')),
      horizonDays: Number(fdString(fd, 'horizonDays')),
      cancellationHours: Number(fdString(fd, 'cancellationHours')),
      publish: fdString(fd, 'publish') === 'yes',
      phone: fdString(fd, 'phone'),
      email: fdString(fd, 'email'),
    })
  } catch (error) {
    return { error: friendlyError(error) }
  }
  revalidatePath('/', 'layout')
  redirect('/onboarding?saved=1')
}

export async function addAvailabilityBlockAction(
  _previous: BookingFormState,
  fd: FormData,
): Promise<BookingFormState> {
  const user = await requireOwner()
  const settings = await getSettings(user.businessId)
  try {
    const start = parseDatetimeLocal(fdString(fd, 'startsAt'), settings.timezone)
    const end = parseDatetimeLocal(fdString(fd, 'endsAt'), settings.timezone)
    if (!start || !end) throw new Error('Choose the start and end of your time off')
    if (
      toDatetimeLocalValue(start, settings.timezone) !== fdString(fd, 'startsAt') ||
      toDatetimeLocalValue(end, settings.timezone) !== fdString(fd, 'endsAt')
    )
      throw new Error('Choose valid local times; this time may not exist when clocks change')
    await createAvailabilityBlock(user.businessId, start, end, fdString(fd, 'reason'))
  } catch (error) {
    return { error: friendlyError(error) }
  }
  revalidatePath('/', 'layout')
  redirect('/availability?saved=1')
}

export async function removeAvailabilityBlockAction(fd: FormData): Promise<void> {
  const user = await requireOwner()
  await prisma.$transaction(
    async (tx) => {
      await lockBusinessSchedule(tx, user.businessId)
      await tx.availabilityBlock.deleteMany({
        where: { id: fdString(fd, 'id'), businessId: user.businessId },
      })
    },
    { timeout: 20_000, maxWait: 20_000 },
  )
  revalidatePath('/', 'layout')
  redirect('/availability')
}

export async function savePortalVehicleAction(
  _previous: BookingFormState,
  fd: FormData,
): Promise<BookingFormState> {
  const user = await requirePortalUser('/portal/vehicles')
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: fdString(fd, 'customerId'), userId: user.id },
      select: { id: true, businessId: true },
    })
    if (!customer) throw new Error('Customer account not found')
    const make = fdString(fd, 'make').trim().slice(0, 80)
    const model = fdString(fd, 'model').trim().slice(0, 80)
    const yearRaw = fdString(fd, 'year')
    const year = yearRaw ? Number(yearRaw) : null
    if (
      !make ||
      !model ||
      (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2100))
    )
      throw new Error('Enter a make, model and valid year')
    const data = { make, model, year, color: fdString(fd, 'color').trim().slice(0, 80) }
    const id = fdString(fd, 'id')
    if (id) {
      const result = await prisma.vehicle.updateMany({
        where: { id, businessId: customer.businessId, customerId: customer.id },
        data,
      })
      if (!result.count) throw new Error('Vehicle not found')
    } else
      await prisma.vehicle.create({
        data: { ...data, businessId: customer.businessId, customerId: customer.id },
      })
  } catch (error) {
    return { error: friendlyError(error) }
  }
  revalidatePath('/', 'layout')
  redirect('/portal/vehicles?saved=1')
}
