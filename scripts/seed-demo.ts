import { randomUUID } from 'node:crypto'
import { demoMarketingDraft } from '@/lib/ai/demoMarketing'
import { buildMarketingContext } from '@/lib/ai/marketing'
import { hashPassword } from '@/lib/auth/password'
import { addDays, todayWall, wallTimeToUtc } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { DEMO_PASSWORD, demoEnabled } from '@/lib/demo'
import type { Prisma } from '@/lib/generated/prisma/client'
import { createAvailabilityBlock, submitPublicBooking } from '@/lib/ops/bookings'

if (!demoEnabled()) throw new Error('Refusing to seed customer fixtures outside the isolated demo.')
const businessId = 'suds-legacy'
const timezone = 'America/New_York'
const today = todayWall(timezone)
const at = (offset: number, hour: number) =>
  wallTimeToUtc({ ...addDays(today, offset), hour, minute: 0 }, timezone)
const hours = Array.from({ length: 7 }, (_, day) => ({ day, start: '09:00', end: '19:00' }))

try {
  await prisma.settings.update({
    where: { businessId },
    data: { workingHours: hours, leadTimeMin: 0, cancellationHours: 0 },
  })
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: 'owner@suds.local' } })
  const customerUser = await prisma.user.create({
    data: {
      email: 'customer@suds.local',
      name: 'Marcus Rivera',
      passwordHash: await hashPassword(DEMO_PASSWORD),
      emailVerifiedAt: new Date(),
    },
  })
  const customer = await prisma.customer.findFirstOrThrow({
    where: { businessId, name: 'Marcus Rivera' },
    include: { vehicles: true },
  })
  await prisma.customer.update({
    where: { id: customer.id },
    data: {
      userId: customerUser.id,
      email: customerUser.email,
      address: '42 Example Lane, Cincinnati, OH',
    },
  })
  const service = await prisma.service.findFirstOrThrow({
    where: { businessId, name: 'Express Wash & Wax' },
  })
  await prisma.service.update({ where: { id: service.id }, data: { sort: 0 } })
  const vehicle = customer.vehicles[0]
  if (!vehicle) throw new Error('Demo vehicle is missing')
  await submitPublicBooking(customerUser.id, {
    slug: 'suds-detailing',
    serviceIds: [service.id],
    vehicleId: vehicle.id,
    scheduledAt: at(2, 13),
    idempotencyKey: randomUUID(),
    phone: '(513) 555-0121',
    address: '42 Example Lane, Cincinnati, OH',
    waterPowerNotes: 'Outdoor outlet available.',
  })
  await createAvailabilityBlock(businessId, at(4, 12), at(4, 13), 'Lunch and supply run')
  // Explicit fictional owner approval: also leave two photos private to demonstrate the toggle.
  const photos = await prisma.photo.findMany({
    where: { businessId },
    orderBy: { createdAt: 'asc' },
  })
  await prisma.photo.updateMany({
    where: { id: { in: photos.slice(0, 10).map((photo) => photo.id) }, businessId },
    data: { approvedForMarketing: true },
  })

  const ridge = await prisma.business.create({
    data: {
      slug: 'ridge-detail-demo',
      name: 'Ridge Detail Co.',
      status: 'PUBLISHED',
      serviceArea: 'Cincinnati, OH',
      memberships: { create: { userId: owner.id, role: 'OWNER', acceptedAt: new Date() } },
      settings: {
        create: {
          businessName: 'Ridge Detail Co.',
          setupComplete: true,
          city: 'Cincinnati, OH',
          phone: '(513) 555-0190',
          bookingMode: 'REQUEST',
          workingHours: hours,
          timezone,
          leadTimeMin: 0,
          cancellationHours: 0,
        },
      },
      services: {
        create: {
          name: 'Exterior Refresh',
          category: 'EXTERIOR',
          description: 'Hand wash, wheels, glass and protection.',
          priceCents: 9500,
          durationMin: 90,
        },
      },
    },
    include: { services: true },
  })
  const ridgeService = ridge.services[0]
  if (!ridgeService) throw new Error('Demo request service is missing')
  await submitPublicBooking(customerUser.id, {
    slug: ridge.slug,
    serviceIds: [ridgeService.id],
    scheduledAt: at(3, 10),
    idempotencyKey: randomUUID(),
    make: 'Tesla',
    model: 'Model 3',
    year: 2021,
    phone: '(513) 555-0121',
    address: '42 Example Lane, Cincinnati, OH',
    customerNotes: 'Please confirm this appointment time.',
  })
  const completed = await prisma.job.findFirstOrThrow({
    where: { businessId, status: 'COMPLETED', photos: { some: { approvedForMarketing: true } } },
  })
  const photoIds = photos
    .filter((photo) => photo.jobId === completed.id)
    .slice(0, 2)
    .map((photo) => photo.id)
  const brief = {
    task: 'job' as const,
    brief: 'A fresh finish after a complete detail.',
    platform: 'INSTAGRAM' as const,
    voice: 'friendly' as const,
    jobId: completed.id,
    photoIds,
    approved: true as const,
  }
  const context = await buildMarketingContext(businessId, brief)
  await prisma.aiRun.create({
    data: {
      businessId,
      userId: owner.id,
      kind: 'MARKETING',
      status: 'COMPLETED',
      provider: 'demo',
      idempotencyKey: randomUUID(),
      request: { brief, context } as unknown as Prisma.InputJsonValue,
      output: {
        ...demoMarketingDraft(brief, context),
        contextSnapshot: context,
      } as unknown as Prisma.InputJsonValue,
    },
  })
  console.log(
    'Added customer portal, instant appointment, pending approval, time off and sample assistant draft.',
  )
} finally {
  await prisma.$disconnect()
}
