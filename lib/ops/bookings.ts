import { z } from 'zod'
import {
  assertPublicSlot,
  availableSlots,
  parseBookingInstant,
  parseWorkingHours,
} from '@/lib/bookingAvailability'
import {
  assertScheduleAvailable,
  dayWindow,
  lockBusinessSchedule,
  scheduleBusyIntervals,
} from '@/lib/bookingSchedule'
import { formatDateTime } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { TX_OPTS } from '@/lib/db/txOptions'
import type { Booking, Prisma } from '@/lib/generated/prisma/client'
import { queueEmail } from '@/lib/notifications'

const snapshotSchema = z
  .array(
    z.object({
      serviceId: z.string().nullable(),
      name: z.string(),
      priceCents: z.number().int().nonnegative(),
      durationMin: z.number().int().nonnegative(),
      sort: z.number().int(),
    }),
  )
  .min(1)

export function bookingServices(value: unknown) {
  return snapshotSchema.parse(value)
}

const inputSchema = z.object({
  slug: z.string().min(1).max(100),
  serviceIds: z.array(z.string().min(1)).min(1).max(10),
  scheduledAt: z.preprocess((value) => parseBookingInstant(value) ?? value, z.date()),
  idempotencyKey: z.string().min(16).max(100),
  vehicleId: z.string().optional(),
  make: z.string().trim().max(80).default(''),
  model: z.string().trim().max(80).default(''),
  year: z.number().int().min(1900).max(2100).nullable().default(null),
  phone: z.string().trim().min(5, 'Enter a contact phone number').max(40),
  address: z
    .string()
    .trim()
    .min(8, 'Enter the address where we should detail your vehicle')
    .max(500),
  customerNotes: z.string().trim().max(2000).default(''),
  waterPowerNotes: z.string().trim().max(1000).default(''),
})

export type PublicBookingInput = z.input<typeof inputSchema>

export async function publicBusiness(slug: string) {
  return prisma.business.findFirst({
    where: { slug, status: 'PUBLISHED' },
    include: {
      settings: true,
      services: {
        where: { active: true, durationMin: { gte: 15 }, category: { not: 'ADDON' } },
        orderBy: [{ sort: 'asc' }, { name: 'asc' }],
      },
    },
  })
}

export async function publicAvailability(businessId: string, day: string, serviceIds: string[]) {
  return prisma.$transaction(async (tx) => {
    const business = await tx.business.findFirst({
      where: { id: businessId, status: 'PUBLISHED' },
      include: { settings: true },
    })
    if (
      !business?.settings ||
      serviceIds.length === 0 ||
      serviceIds.length > 10 ||
      new Set(serviceIds).size !== serviceIds.length
    )
      return []
    const services = await tx.service.findMany({
      where: { businessId, id: { in: serviceIds }, active: true },
    })
    if (services.length !== serviceIds.length) return []
    const duration = services.reduce((total, service) => total + service.durationMin, 0)
    if (
      duration < 15 ||
      duration > 1440 ||
      services.every((service) => service.category === 'ADDON')
    )
      return []
    const window = dayWindow(day, business.settings.timezone)
    if (!window) return []
    return availableSlots(
      business.settings,
      day,
      duration,
      await scheduleBusyIntervals(tx, businessId, { window }),
    )
  }, TX_OPTS)
}

async function createBookingJob(tx: Prisma.TransactionClient, booking: Booking) {
  const lines = bookingServices(booking.serviceSnapshots)
  const existingServices = await tx.service.findMany({
    where: {
      businessId: booking.businessId,
      id: { in: lines.map((line) => line.serviceId).filter((id): id is string => id !== null) },
    },
    select: { id: true },
  })
  const catalogIds = new Set(existingServices.map((service) => service.id))
  return tx.job.create({
    data: {
      businessId: booking.businessId,
      customerId: booking.customerId,
      vehicleId: booking.vehicleId,
      scheduledAt: booking.scheduledAt,
      durationMin: booking.durationMin,
      locationAddress: booking.address,
      waterPowerNotes: booking.waterPowerNotes,
      notes: booking.customerNotes,
      internalNotes: '',
      items: {
        create: lines.map((line) => ({
          ...line,
          serviceId: line.serviceId && catalogIds.has(line.serviceId) ? line.serviceId : null,
        })),
      },
    },
  })
}

export async function queueBookingNotice(
  tx: Prisma.TransactionClient,
  booking: Booking,
  event: string,
) {
  const [settings, customer, business] = await Promise.all([
    tx.settings.findUniqueOrThrow({ where: { businessId: booking.businessId } }),
    tx.customer.findUniqueOrThrow({ where: { id: booking.customerId }, include: { user: true } }),
    tx.business.findUniqueOrThrow({ where: { id: booking.businessId } }),
  ])
  await tx.notificationOutbox.updateMany({
    where: {
      businessId: booking.businessId,
      status: { in: ['PENDING', 'PROCESSING'] },
      dedupeKey: { startsWith: `booking:${booking.id}:` },
    },
    data: { status: 'CANCELED', lockedAt: null, lastError: 'Appointment changed before delivery.' },
  })
  const owners = await tx.businessMembership.findMany({
    where: {
      businessId: booking.businessId,
      active: true,
      role: 'OWNER',
      user: { active: true, emailVerifiedAt: { not: null } },
    },
    select: { user: { select: { email: true } } },
  })
  for (const { user } of owners) {
    await queueEmail(tx, {
      businessId: booking.businessId,
      to: user.email,
      subject: `${business.name}: appointment ${event}`,
      text: `${customer.name} has an appointment ${event}.\n${formatDateTime(booking.scheduledAt, settings.timezone)} (${settings.timezone})\nReview bookings in your Suds workspace.`,
      dedupeKey: `booking:${booking.id}:owner:${user.email}:${event}:${booking.scheduledAt.toISOString()}:v${booking.updatedAt.toISOString()}`,
    })
  }
  const text = `${business.name}: your appointment ${event}.\n${formatDateTime(booking.scheduledAt, settings.timezone)} (${settings.timezone})\n${bookingServices(
    booking.serviceSnapshots,
  )
    .map((s) => s.name)
    .join(', ')}\n${booking.address}\nManage your appointment in your Suds customer portal.`
  if (customer.user?.emailVerifiedAt) {
    await queueEmail(tx, {
      businessId: booking.businessId,
      to: customer.user.email,
      subject: `${business.name}: appointment ${event}`,
      text,
      dedupeKey: `booking:${booking.id}:${event}:${booking.scheduledAt.toISOString()}:v${booking.updatedAt.toISOString()}`,
    })
    if (booking.status === 'CONFIRMED') {
      const reminderAt = new Date(booking.scheduledAt.getTime() - 24 * 60 * 60_000)
      if (reminderAt.getTime() > Date.now())
        await queueEmail(tx, {
          businessId: booking.businessId,
          to: customer.user.email,
          subject: `${business.name}: appointment tomorrow`,
          text: text.replace(`appointment ${event}`, 'appointment is tomorrow'),
          availableAt: reminderAt,
          dedupeKey: `booking:${booking.id}:reminder:${booking.scheduledAt.toISOString()}:v${booking.updatedAt.toISOString()}`,
        })
    }
  }
}

// Owner pages list a customer's vehicles in full, and a pending request holds no
// time, so what one self-service account can pile up is capped.
const MAX_CUSTOMER_VEHICLES = 25
const MAX_OPEN_BOOKINGS = 10

export async function assertVehicleRoom(
  db: Prisma.TransactionClient | typeof prisma,
  businessId: string,
  customerId: string,
) {
  if ((await db.vehicle.count({ where: { businessId, customerId } })) >= MAX_CUSTOMER_VEHICLES)
    throw new Error('You have reached the vehicle limit. Edit a saved vehicle instead.')
}

/** Typed email never links records. A verified signed-in identity owns the customer association. */
export async function submitPublicBooking(userId: string, raw: PublicBookingInput) {
  const input = inputSchema.parse(raw)
  if (new Set(input.serviceIds).size !== input.serviceIds.length)
    throw new Error('Choose each service only once')
  return prisma.$transaction(async (tx) => {
    const business = await tx.business.findFirst({
      where: { slug: input.slug, status: 'PUBLISHED' },
      include: { settings: true },
    })
    if (!business?.settings) throw new Error('This business is not accepting bookings')
    await lockBusinessSchedule(tx, business.id)
    const user = await tx.user.findUnique({ where: { id: userId } })
    if (!user?.active || !user.emailVerifiedAt) throw new Error('Verify your email before booking')
    let customer = await tx.customer.findFirst({ where: { businessId: business.id, userId } })
    if (customer) {
      const existing = await tx.booking.findFirst({
        where: {
          businessId: business.id,
          customerId: customer.id,
          idempotencyKey: input.idempotencyKey,
        },
      })
      if (existing) return existing
      const open = await tx.booking.count({
        where: {
          businessId: business.id,
          customerId: customer.id,
          status: { in: ['PENDING', 'CONFIRMED'] },
          scheduledAt: { gt: new Date() },
        },
      })
      if (open >= MAX_OPEN_BOOKINGS)
        throw new Error(
          'You already have several upcoming appointments here. Contact the business to book more.',
        )
    }
    const services = await tx.service.findMany({
      where: { businessId: business.id, id: { in: input.serviceIds }, active: true },
    })
    if (services.length !== input.serviceIds.length)
      throw new Error('One of these services is no longer available')
    if (services.every((service) => service.category === 'ADDON'))
      throw new Error('Choose a detailing package before adding extras')
    const byId = new Map(services.map((service) => [service.id, service]))
    const snapshots = input.serviceIds.map((id, sort) => {
      const service = byId.get(id)
      if (!service) throw new Error('Service unavailable')
      return {
        serviceId: service.id,
        name: service.name,
        priceCents: service.priceCents,
        durationMin: service.durationMin,
        sort,
      }
    })
    const durationMin = snapshots.reduce((total, item) => total + item.durationMin, 0)
    assertPublicSlot(business.settings, input.scheduledAt, durationMin)
    await assertScheduleAvailable(tx, business.id, input.scheduledAt, durationMin)
    if (!customer)
      customer = await tx.customer.create({
        data: {
          businessId: business.id,
          userId,
          name: user.name,
          email: user.email,
          phone: input.phone,
          address: input.address,
        },
      })
    else
      customer = await tx.customer.update({
        where: { businessId_id: { businessId: business.id, id: customer.id } },
        data: { phone: input.phone, address: input.address },
      })
    let vehicle: { id: string } | null = null
    if (input.vehicleId) {
      vehicle = await tx.vehicle.findFirst({
        where: { id: input.vehicleId, businessId: business.id, customerId: customer.id },
      })
      if (!vehicle) throw new Error('Choose one of your vehicles')
    } else {
      if (!input.make || !input.model) throw new Error('Enter your vehicle make and model')
      await assertVehicleRoom(tx, business.id, customer.id)
      vehicle = await tx.vehicle.create({
        data: {
          businessId: business.id,
          customerId: customer.id,
          make: input.make,
          model: input.model,
          year: input.year,
        },
      })
    }
    const status = business.settings.bookingMode === 'REQUEST' ? 'PENDING' : 'CONFIRMED'
    let booking = await tx.booking.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        vehicleId: vehicle.id,
        scheduledAt: input.scheduledAt,
        durationMin,
        serviceSnapshots: snapshots,
        priceCents: snapshots.reduce((sum, item) => sum + item.priceCents, 0),
        idempotencyKey: input.idempotencyKey,
        status,
        address: input.address,
        customerNotes: input.customerNotes,
        waterPowerNotes: input.waterPowerNotes,
      },
    })
    if (status === 'CONFIRMED') {
      const job = await createBookingJob(tx, booking)
      booking = await tx.booking.update({ where: { id: booking.id }, data: { jobId: job.id } })
    }
    await queueBookingNotice(tx, booking, status === 'PENDING' ? 'requested' : 'confirmed')
    return booking
  }, TX_OPTS)
}

export async function decideBooking(businessId: string, bookingId: string, accept: boolean) {
  return prisma.$transaction(async (tx) => {
    await lockBusinessSchedule(tx, businessId)
    const booking = await tx.booking.findFirst({ where: { id: bookingId, businessId } })
    if (!booking) throw new Error('Appointment not found')
    if (booking.status === (accept ? 'CONFIRMED' : 'DECLINED')) return booking
    if (booking.status !== 'PENDING') throw new Error('This request has already been handled')
    if (!accept) {
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'DECLINED', reservedUntil: null },
      })
      await queueBookingNotice(tx, updated, 'declined')
      return updated
    }
    if (booking.scheduledAt.getTime() <= Date.now())
      throw new Error('This appointment time has already passed')
    const settings = await tx.settings.findUniqueOrThrow({ where: { businessId } })
    assertPublicSlot({ ...settings, leadTimeMin: 0 }, booking.scheduledAt, booking.durationMin)
    await assertScheduleAvailable(tx, businessId, booking.scheduledAt, booking.durationMin, {
      excludeBookingId: booking.id,
    })
    const job = await createBookingJob(tx, booking)
    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: { status: 'CONFIRMED', jobId: job.id, reservedUntil: null },
    })
    await queueBookingNotice(tx, updated, 'confirmed')
    return updated
  }, TX_OPTS)
}

async function customerBooking(tx: Prisma.TransactionClient, userId: string, bookingId: string) {
  const booking = await tx.booking.findFirst({
    where: {
      id: bookingId,
      customer: { userId, user: { active: true, emailVerifiedAt: { not: null } } },
    },
    include: { job: { select: { status: true } }, business: { include: { settings: true } } },
  })
  if (!booking) throw new Error('Appointment not found')
  if (!booking.business.settings) throw new Error('Business unavailable')
  return booking
}

// A customer may change a booking only while it is open and any linked job has not started.
function isCustomerChangeable(booking: { status: string; job: { status: string } | null }) {
  return (
    ['PENDING', 'CONFIRMED'].includes(booking.status) &&
    (!booking.job || booking.job.status === 'SCHEDULED')
  )
}

// Ignore the booking being changed (and its job) when checking schedule conflicts.
function excludeFor(booking: { id: string; jobId: string | null }) {
  return {
    excludeBookingId: booking.id,
    ...(booking.jobId ? { excludeJobId: booking.jobId } : {}),
  }
}

export async function customerRescheduleAvailability(
  userId: string,
  bookingId: string,
  day: string,
) {
  return prisma.$transaction(async (tx) => {
    const booking = await customerBooking(tx, userId, bookingId)
    if (!isCustomerChangeable(booking)) return []
    const settings = booking.business.settings
    const window = settings && dayWindow(day, settings.timezone)
    if (!settings || !window) return []
    return availableSlots(
      settings,
      day,
      booking.durationMin,
      await scheduleBusyIntervals(tx, booking.businessId, { window, ...excludeFor(booking) }),
    )
  }, TX_OPTS)
}

export async function changeCustomerBooking(
  userId: string,
  bookingId: string,
  newTime: Date | null,
) {
  return prisma.$transaction(async (tx) => {
    // Resolve businessId first so the business lock is taken before the authoritative
    // re-read; the second read sees the state after any concurrent change commits.
    const initial = await customerBooking(tx, userId, bookingId)
    await lockBusinessSchedule(tx, initial.businessId)
    const booking = await customerBooking(tx, userId, bookingId)
    if (!newTime && booking.status === 'CANCELED') return booking
    if (!isCustomerChangeable(booking))
      throw new Error('This appointment can no longer be changed online. Contact the detailer.')
    const settings = booking.business.settings
    if (!settings) throw new Error('Business unavailable')
    if (booking.scheduledAt.getTime() < Date.now() + settings.cancellationHours * 60 * 60_000)
      throw new Error(
        `Changes require ${settings.cancellationHours} hours notice. Contact the detailer.`,
      )
    if (!newTime) {
      if (booking.jobId)
        await tx.job.update({ where: { id: booking.jobId }, data: { status: 'CANCELED' } })
      const updated = await tx.booking.update({
        where: { id: booking.id },
        data: { status: 'CANCELED', reservedUntil: null },
      })
      await queueBookingNotice(tx, updated, 'canceled')
      return updated
    }
    if (booking.scheduledAt.getTime() === newTime.getTime()) return booking
    assertPublicSlot(settings, newTime, booking.durationMin)
    await assertScheduleAvailable(
      tx,
      booking.businessId,
      newTime,
      booking.durationMin,
      excludeFor(booking),
    )
    // An approved request remains approved when the customer chooses another available time.
    if (booking.jobId)
      await tx.job.update({ where: { id: booking.jobId }, data: { scheduledAt: newTime } })
    const updated = await tx.booking.update({
      where: { id: booking.id },
      data: { scheduledAt: newTime, reservedUntil: null },
    })
    await queueBookingNotice(tx, updated, 'rescheduled')
    return updated
  }, TX_OPTS)
}

export async function saveBookingSetup(
  businessId: string,
  input: {
    name: string
    slug: string
    serviceArea: string
    timezone: string
    bookingMode: 'INSTANT' | 'REQUEST'
    workingHours: unknown
    travelBufferMin: number
    leadTimeMin: number
    horizonDays: number
    cancellationHours: number
    publish: boolean
    phone: string
    email: string
  },
) {
  const data = z
    .object({
      name: z.string().trim().min(2).max(100),
      slug: z
        .string()
        .trim()
        .min(3)
        .max(80)
        .regex(
          /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
          'Use lowercase letters, numbers and hyphens for your booking link',
        ),
      serviceArea: z.string().trim().min(2).max(1000),
      timezone: z.string().max(100),
      bookingMode: z.enum(['INSTANT', 'REQUEST']),
      travelBufferMin: z.number().int().min(0).max(240),
      leadTimeMin: z.number().int().min(0).max(10080),
      horizonDays: z.number().int().min(1).max(180),
      cancellationHours: z.number().int().min(0).max(168),
      publish: z.boolean(),
      phone: z.string().trim().max(40),
      email: z.string().trim().email().or(z.literal('')),
    })
    .parse(input)
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: data.timezone }).format()
  } catch {
    throw new Error('Choose a valid timezone')
  }
  const workingHours = parseWorkingHours(input.workingHours)
  return prisma.$transaction(async (tx) => {
    await lockBusinessSchedule(tx, businessId)
    if (data.publish) {
      if (workingHours.length === 0)
        throw new Error('Set at least one day of working hours before publishing')
      const services = await tx.service.count({
        where: { businessId, active: true, durationMin: { gte: 15 }, category: { not: 'ADDON' } },
      })
      if (services === 0)
        throw new Error('Add an active service with a price and duration before publishing')
    }
    await tx.business.update({
      where: { id: businessId },
      data: {
        name: data.name,
        slug: data.slug,
        serviceArea: data.serviceArea,
        status: data.publish ? 'PUBLISHED' : 'DRAFT',
      },
    })
    await tx.settings.update({
      where: { businessId },
      data: {
        businessName: data.name,
        timezone: data.timezone,
        bookingMode: data.bookingMode,
        workingHours: workingHours.map((window) => ({ ...window })),
        travelBufferMin: data.travelBufferMin,
        leadTimeMin: data.leadTimeMin,
        horizonDays: data.horizonDays,
        cancellationHours: data.cancellationHours,
        setupComplete: data.publish,
        phone: data.phone,
        email: data.email,
      },
    })
  }, TX_OPTS)
}

export async function createAvailabilityBlock(
  businessId: string,
  start: Date,
  end: Date,
  reason: string,
) {
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start)
    throw new Error('Choose a block ending after it starts')
  return prisma.$transaction(async (tx) => {
    await lockBusinessSchedule(tx, businessId)
    // Existing jobs stay visible; a block is only a restriction on future bookings.
    return tx.availabilityBlock.create({
      data: { businessId, startsAt: start, endsAt: end, reason: reason.trim().slice(0, 200) },
    })
  }, TX_OPTS)
}
