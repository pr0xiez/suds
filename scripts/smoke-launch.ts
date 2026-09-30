import { randomBytes } from 'node:crypto'
import { hashPassword } from '@/lib/auth/password'
import { businessUserFor } from '@/lib/business'
import { addDays, dateKey, todayWall } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import {
  changeCustomerBooking,
  createAvailabilityBlock,
  decideBooking,
  publicAvailability,
  submitPublicBooking,
} from '@/lib/ops/bookings'
import { addVehicle, createCustomer, updateCustomer } from '@/lib/ops/customers'
import { createJob, ensureInvoice, setJobStatus, updateJob } from '@/lib/ops/jobs'
import { createService, deleteService } from '@/lib/ops/services'
import { createPost } from '@/lib/ops/social'
import { cleanupFixtureBusiness } from './fixtures'

const suffix = randomBytes(8).toString('hex')
const businessA = `launch${suffix}a`
const businessB = `launch${suffix}b`
const userIds: string[] = []
function assert(value: unknown, message: string): asserts value {
  if (!value) throw new Error(message)
}
async function rejected(action: () => Promise<unknown>, message: string) {
  let failed = false
  try {
    await action()
  } catch {
    failed = true
  }
  assert(failed, message)
}

async function main() {
  const passwordHash = await hashPassword(`Fixture-${suffix}`)
  const owner = await prisma.user.create({
    data: {
      email: `owner-${suffix}@example.test`,
      name: 'Fixture owner',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  })
  userIds.push(owner.id)
  const customers = await Promise.all(
    [0, 1, 2].map(async (index) => {
      const user = await prisma.user.create({
        data: {
          email: `customer-${suffix}-${index}@example.test`,
          name: `Fixture customer ${index}`,
          passwordHash,
          emailVerifiedAt: index === 2 ? null : new Date(),
        },
      })
      userIds.push(user.id)
      return user
    }),
  )
  const first = customers[0],
    second = customers[1],
    unverified = customers[2]
  assert(first && second && unverified, 'Fixture identities missing')
  for (const businessId of [businessA, businessB]) {
    await prisma.business.create({
      data: {
        id: businessId,
        slug: `suds-test-${businessId}`,
        name: 'Launch fixture',
        status: 'PUBLISHED',
        serviceArea: 'Test city',
        settings: {
          create: {
            setupComplete: true,
            timezone: 'America/New_York',
            leadTimeMin: 0,
            travelBufferMin: 30,
            cancellationHours: 0,
            workingHours: Array.from({ length: 7 }, (_, day) => ({
              day,
              start: '08:00',
              end: '20:00',
            })),
          },
        },
        memberships: {
          create: {
            userId: owner.id,
            role: businessId === businessA ? 'OWNER' : 'STAFF',
            acceptedAt: new Date(),
          },
        },
      },
    })
  }
  const [serviceA, serviceB] = await Promise.all(
    [businessA, businessB].map((id) =>
      createService(id, {
        name: 'Fixture detail',
        description: '',
        priceCents: 12500,
        durationMin: 60,
        category: 'FULL',
        active: true,
        sort: 0,
      }),
    ),
  )
  assert(serviceA && serviceB, 'Fixture services missing')
  assert(
    (await businessUserFor(owner, businessA))?.businessRole === 'OWNER',
    'Owner membership not resolved',
  )
  assert(
    (await businessUserFor(owner, businessB))?.businessRole === 'STAFF',
    'A global role leaked into a different membership',
  )
  assert(
    (await businessUserFor(first, businessA)) === null,
    'Customer gained owner workspace access',
  )
  const day = dateKey(addDays(todayWall('America/New_York'), 2))
  const slots = await publicAvailability(businessA, day, [serviceA.id])
  assert(slots.length > 4, 'No public appointment slots available')
  const start = slots[0]
  assert(start, 'Missing booking start')
  const input = {
    slug: `suds-test-${businessA}`,
    serviceIds: [serviceA.id],
    scheduledAt: start,
    idempotencyKey: `booking-${suffix}-first`,
    make: 'Toyota',
    model: 'Camry',
    phone: '5550000123',
    address: '100 Fixture Street',
  }
  await rejected(() => submitPublicBooking(unverified.id, input), 'Unverified identity could book')
  await rejected(
    () => submitPublicBooking(first.id, { ...input, serviceIds: [serviceB.id] }),
    'Foreign business service was accepted',
  )
  const results = await Promise.allSettled([
    submitPublicBooking(first.id, input),
    submitPublicBooking(second.id, { ...input, idempotencyKey: `booking-${suffix}-second` }),
  ])
  assert(
    results.filter((result) => result.status === 'fulfilled').length === 1,
    'Concurrent booking confirmed the same time twice',
  )
  const winner = results.find((result) => result.status === 'fulfilled')
  assert(winner?.status === 'fulfilled', 'Neither concurrent booking succeeded')
  const booking = winner.value
  assert(booking.status === 'CONFIRMED' && booking.jobId, 'Instant booking did not create a job')
  const winnerUser = results[0]?.status === 'fulfilled' ? first : second
  const otherUser = winnerUser.id === first.id ? second : first
  const winnerInput =
    winnerUser.id === first.id ? input : { ...input, idempotencyKey: `booking-${suffix}-second` }
  const retry = await submitPublicBooking(winnerUser.id, winnerInput)
  assert(retry.id === booking.id, 'Booking retry duplicated the appointment')
  assert(
    (await prisma.job.count({ where: { businessId: businessA } })) === 1,
    'Booking retry duplicated its job',
  )
  await rejected(
    () => changeCustomerBooking(otherUser.id, booking.id, null),
    'Another customer canceled the appointment',
  )
  const remaining = await publicAvailability(businessA, day, [serviceA.id])
  const newTime = remaining.find((slot) => slot.getTime() > start.getTime() + 90 * 60_000)
  assert(newTime, 'No reschedule time found')
  const moved = await changeCustomerBooking(winnerUser.id, booking.id, newTime)
  assert(moved.scheduledAt.getTime() === newTime.getTime(), 'Booking did not reschedule')
  const job = await prisma.job.findUniqueOrThrow({
    where: { id: booking.jobId },
    include: { items: true },
  })
  assert(
    job.scheduledAt.getTime() === newTime.getTime() && job.items[0]?.priceCents === 12500,
    'Job and booking lost their time or service snapshot',
  )
  const invoice = await ensureInvoice(businessA, job.id)
  assert((await ensureInvoice(businessA, job.id)) === invoice, 'Invoice retry changed its number')
  await changeCustomerBooking(winnerUser.id, booking.id, null)
  assert(
    (await prisma.job.findUniqueOrThrow({ where: { id: job.id } })).status === 'CANCELED',
    'Cancel did not release the job',
  )
  const reminders = await prisma.notificationOutbox.count({
    where: {
      businessId: businessA,
      status: 'PENDING',
      dedupeKey: { startsWith: `booking:${booking.id}:reminder:` },
    },
  })
  assert(reminders === 0, 'Canceled appointment still has an active reminder')
  await prisma.settings.update({
    where: { businessId: businessA },
    data: { bookingMode: 'REQUEST' },
  })
  const requestTime = (await publicAvailability(businessA, day, [serviceA.id]))[0]
  assert(requestTime, 'No request slot found')
  const request = await submitPublicBooking(otherUser.id, {
    ...input,
    scheduledAt: requestTime,
    idempotencyKey: `request-${suffix}`,
  })
  assert(
    request.status === 'PENDING' && request.jobId === null,
    'Approval mode silently confirmed a request',
  )
  await rejected(
    () => decideBooking(businessB, request.id, true),
    'A different business accepted a request',
  )
  await deleteService(businessA, serviceA.id)
  const accepted = await decideBooking(businessA, request.id, true)
  assert(accepted.status === 'CONFIRMED' && accepted.jobId, 'Owner approval did not create a job')
  assert(
    (await decideBooking(businessA, request.id, true)).jobId === accepted.jobId,
    'Approval retry duplicated a job',
  )
  const acceptedJob = await prisma.job.findUniqueOrThrow({
    where: { id: accepted.jobId },
    include: { items: true },
  })
  assert(
    acceptedJob.items[0]?.serviceId === null && acceptedJob.items[0]?.priceCents === 12500,
    'Deleted catalog service broke the booked snapshot',
  )
  const alternateCustomer = await createCustomer(businessA, {
    name: 'Alternate fixture',
    phone: '',
    email: '',
    address: '',
    notes: '',
  })
  const alternateVehicle = await addVehicle(businessA, alternateCustomer.id, {
    year: null,
    make: 'Honda',
    model: 'Civic',
    color: '',
    plate: '',
    notes: '',
  })
  const editedTime = new Date(requestTime.getTime() + 3 * 3600_000)
  const ownerEdit = {
    customerId: acceptedJob.customerId,
    vehicleId: acceptedJob.vehicleId,
    scheduledAt: editedTime,
    serviceIds: [],
    customLines: [{ name: 'Adjusted detail', priceCents: 14000, durationMin: 75 }],
    durationMin: null,
    notes: 'Customer-visible update',
    internalNotes: 'Private owner update',
    discountCents: 0,
  }
  await rejected(
    () =>
      updateJob(businessA, acceptedJob.id, {
        ...ownerEdit,
        customerId: alternateCustomer.id,
        vehicleId: alternateVehicle.id,
      }),
    'Owner reassigned a linked booking to another customer',
  )
  await updateJob(businessA, acceptedJob.id, ownerEdit)
  const changedBooking = await prisma.booking.findUniqueOrThrow({ where: { id: accepted.id } })
  assert(
    changedBooking.scheduledAt.getTime() === editedTime.getTime() &&
      changedBooking.durationMin === 75 &&
      changedBooking.priceCents === 14000,
    'Owner edits did not synchronize the customer booking',
  )
  await setJobStatus(businessA, acceptedJob.id, 'CANCELED')
  assert(
    (await prisma.booking.findUniqueOrThrow({ where: { id: accepted.id } })).status === 'CANCELED',
    'Owner cancellation did not update customer booking',
  )
  const ownCustomer = await createCustomer(businessB, {
    name: 'Owner fixture customer',
    phone: '',
    email: '',
    address: '',
    notes: 'Private owner note',
  })
  const vehicle = await addVehicle(businessB, ownCustomer.id, {
    year: null,
    make: 'Honda',
    model: 'Civic',
    color: '',
    plate: '',
    notes: '',
  })
  await rejected(
    () =>
      updateCustomer(businessA, ownCustomer.id, {
        name: 'Tampered',
        phone: '',
        email: '',
        address: '',
        notes: '',
      }),
    'Foreign customer mutation was accepted',
  )
  await rejected(
    () =>
      createJob(businessA, {
        customerId: ownCustomer.id,
        vehicleId: vehicle.id,
        scheduledAt: new Date(start.getTime() + 8 * 3600_000),
        serviceIds: [serviceA.id],
        customLines: [],
        durationMin: null,
        notes: '',
        internalNotes: '',
        discountCents: 0,
      }),
    'Foreign customer/vehicle linked to owner job',
  )
  const otherJob = await createJob(businessB, {
    customerId: ownCustomer.id,
    vehicleId: vehicle.id,
    scheduledAt: start,
    serviceIds: [serviceB.id],
    customLines: [],
    durationMin: null,
    notes: '',
    internalNotes: '',
    discountCents: 0,
  })
  assert(
    (await ensureInvoice(businessB, otherJob.id)) === invoice,
    'Invoice numbers were not independent per business',
  )
  await rejected(
    () =>
      createPost(businessA, {
        caption: 'Foreign record test',
        platforms: ['INSTAGRAM'],
        scheduledFor: null,
        jobId: otherJob.id,
        photoIds: [],
      }),
    'Foreign job linked to a post',
  )
  const block = await createAvailabilityBlock(
    businessB,
    new Date(start.getTime() + 2 * 3600_000),
    new Date(start.getTime() + 3 * 3600_000),
    'Fixture break',
  )
  const blocked = await publicAvailability(businessB, day, [serviceB.id])
  assert(
    !blocked.some((slot) => slot >= block.startsAt && slot < block.endsAt),
    'Blocked time was offered',
  )
  console.log(
    'PASS: membership isolation, verification, concurrent booking, retries, approval, rescheduling, cancellation, snapshots, blocked time, private record guards, per-business invoices',
  )
}

main().then(
  async () => {
    await cleanup()
  },
  async (error) => {
    console.error('FAIL:', error)
    try {
      await cleanup()
    } finally {
      process.exitCode = 1
    }
  },
)
async function cleanup() {
  for (const businessId of [businessA, businessB]) await cleanupFixtureBusiness(businessId)
  await prisma.user.deleteMany({ where: { id: { in: userIds } } })
  await prisma.$disconnect()
}
