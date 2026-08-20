import { hashPassword } from '@/lib/auth/password'
import { addDays, todayWall, wallTimeToUtc } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import type { PaymentMethod, Platform } from '@/lib/generated/prisma/enums'
import { addPhoto } from '@/lib/ops/photos'
import { deleteUploadFile } from '@/lib/uploads'
import { afterImage, beforeImage } from './seedImages'

/**
 * Idempotent demo seed: wipes every table (and the photo files on disk), then
 * builds a believable two-week window of shop life — history with photos and
 * posts, today's work, an upcoming week, and the loose ends the dashboard is
 * built to surface (an unpaid job, an overdue post, a job with no photos).
 */

const TZ = 'America/New_York'
const DEFAULT_PASSWORD = 'washwaxrepeat'

const today = todayWall(TZ)
const at = (dayOffset: number, hour: number, minute = 0) =>
  wallTimeToUtc({ ...addDays(today, dayOffset), hour, minute }, TZ)

async function wipe() {
  const photos = await prisma.photo.findMany()
  await prisma.postPhoto.deleteMany()
  await prisma.socialPost.deleteMany()
  await prisma.photo.deleteMany()
  await prisma.jobItem.deleteMany()
  await prisma.job.deleteMany()
  await prisma.vehicle.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.captionTemplate.deleteMany()
  await prisma.service.deleteMany()
  await prisma.session.deleteMany()
  await prisma.user.deleteMany()
  await prisma.settings.deleteMany()
  for (const photo of photos) {
    await deleteUploadFile(photo.filename)
  }
}

interface ServiceSeed {
  name: string
  category: 'EXTERIOR' | 'INTERIOR' | 'FULL' | 'ADDON'
  priceCents: number
  durationMin: number
  sort: number
  description?: string
}

const SERVICE_SEEDS: ServiceSeed[] = [
  {
    name: 'Full Detail',
    category: 'FULL',
    priceCents: 25000,
    durationMin: 240,
    sort: 1,
    description: 'Complete interior + exterior reset',
  },
  {
    name: 'Showroom Package',
    category: 'FULL',
    priceCents: 40000,
    durationMin: 360,
    sort: 2,
    description: 'Full detail plus one-step polish',
  },
  {
    name: 'Ceramic Coating',
    category: 'FULL',
    priceCents: 80000,
    durationMin: 480,
    sort: 3,
    description: '2-year coating, includes paint prep',
  },
  { name: 'Express Wash & Wax', category: 'EXTERIOR', priceCents: 8000, durationMin: 90, sort: 10 },
  {
    name: 'Exterior Detail',
    category: 'EXTERIOR',
    priceCents: 15000,
    durationMin: 150,
    sort: 11,
    description: 'Decon wash, clay, sealant',
  },
  {
    name: 'Interior Deep Clean',
    category: 'INTERIOR',
    priceCents: 15000,
    durationMin: 150,
    sort: 20,
    description: 'Extraction, steam, full wipe-down',
  },
  { name: 'Pet Hair Removal', category: 'ADDON', priceCents: 4000, durationMin: 45, sort: 30 },
  { name: 'Engine Bay Detail', category: 'ADDON', priceCents: 3500, durationMin: 30, sort: 31 },
  { name: 'Headlight Restoration', category: 'ADDON', priceCents: 6000, durationMin: 45, sort: 32 },
  { name: 'Odor Bomb Treatment', category: 'ADDON', priceCents: 5000, durationMin: 60, sort: 33 },
]

async function main() {
  console.log('Wiping…')
  await wipe()

  await prisma.settings.create({
    data: {
      id: 1,
      businessName: 'Suds Auto Detailing',
      phone: '(513) 555-0147',
      email: 'hello@sudsdetailing.com',
      address: '4210 Foam Lane',
      city: 'Cincinnati, OH',
      timezone: TZ,
      instagramHandle: 'sudsdetailing',
      facebookPage: 'sudsdetailing',
      tiktokHandle: 'sudsdetailing',
      googleReviewUrl: 'https://g.page/r/suds-example/review',
      hashtags:
        '#detailing #cardetailing #beforeandafter #ceramiccoating #cincinnati #shinebright #sudslife',
      nextInvoiceNumber: 1003,
    },
  })

  const password = process.env.SEED_OWNER_PASSWORD || DEFAULT_PASSWORD
  if (!process.env.SEED_OWNER_PASSWORD) {
    console.warn(`⚠ SEED_OWNER_PASSWORD not set — using the dev default "${DEFAULT_PASSWORD}".`)
  }
  const passwordHash = await hashPassword(password)
  await prisma.user.create({
    data: { email: 'owner@suds.local', name: 'Alex', role: 'OWNER', passwordHash },
  })
  await prisma.user.create({
    data: { email: 'staff@suds.local', name: 'Jordan', role: 'STAFF', passwordHash },
  })

  const services = new Map<
    string,
    { id: string; name: string; priceCents: number; durationMin: number }
  >()
  for (const seed of SERVICE_SEEDS) {
    const created = await prisma.service.create({
      data: { ...seed, description: seed.description ?? '' },
    })
    services.set(seed.name, created)
  }
  const svc = (name: string) => {
    const found = services.get(name)
    if (!found) throw new Error(`Missing seeded service ${name}`)
    return found
  }

  // Customers & vehicles ----------------------------------------------------
  const marcus = await prisma.customer.create({
    data: {
      name: 'Marcus Rivera',
      phone: '(513) 555-0121',
      email: 'marcus@example.com',
      vehicles: { create: [{ year: 2021, make: 'Tesla', model: 'Model 3', color: 'White' }] },
    },
    include: { vehicles: true },
  })
  const dana = await prisma.customer.create({
    data: {
      name: 'Dana Whitfield',
      phone: '(513) 555-0182',
      vehicles: {
        create: [
          { year: 2019, make: 'Ford', model: 'F-150', color: 'Blue', plate: 'DW-4821' },
          { year: 2016, make: 'Honda', model: 'CR-V', color: 'Silver' },
        ],
      },
    },
    include: { vehicles: true },
  })
  const priya = await prisma.customer.create({
    data: {
      name: 'Priya Natarajan',
      phone: '(513) 555-0139',
      email: 'priya@example.com',
      vehicles: { create: [{ year: 2023, make: 'BMW', model: 'M340i', color: 'Black' }] },
    },
    include: { vehicles: true },
  })
  const tom = await prisma.customer.create({
    data: {
      name: 'Tom Okafor',
      phone: '(513) 555-0166',
      vehicles: { create: [{ year: 2018, make: 'Jeep', model: 'Wrangler', color: 'Red' }] },
    },
    include: { vehicles: true },
  })
  const jess = await prisma.customer.create({
    data: {
      name: 'Jess Malone',
      phone: '(513) 555-0110',
      notes: 'Two golden retrievers — expect heavy pet hair.',
      vehicles: { create: [{ year: 2022, make: 'Subaru', model: 'Outback', color: 'Green' }] },
    },
    include: { vehicles: true },
  })
  const hank = await prisma.customer.create({
    data: {
      name: 'Hank Voss',
      phone: '(513) 555-0195',
      notes: 'Garage-kept Corvette. Very particular about swirl marks.',
      vehicles: { create: [{ year: 2015, make: 'Chevrolet', model: 'Corvette', color: 'Yellow' }] },
    },
    include: { vehicles: true },
  })

  // Jobs ---------------------------------------------------------------------
  interface JobSeed {
    customerId: string
    vehicleId: string
    when: Date
    serviceNames: string[]
    custom?: Array<{ name: string; priceCents: number; durationMin: number }>
    status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED' | 'NO_SHOW'
    payment?: { method: PaymentMethod; tipCents?: number }
    invoiceNumber?: number
    discountCents?: number
    notes?: string
  }

  async function makeJob(seed: JobSeed) {
    const lines = [
      ...seed.serviceNames.map((name, i) => {
        const s = svc(name)
        return {
          serviceId: s.id,
          name: s.name,
          priceCents: s.priceCents,
          durationMin: s.durationMin,
          sort: i,
        }
      }),
      ...(seed.custom ?? []).map((line, i) => ({
        serviceId: null,
        ...line,
        sort: seed.serviceNames.length + i,
      })),
    ]
    const durationMin = Math.max(
      lines.reduce((sum, line) => sum + line.durationMin, 0),
      30,
    )
    const completedAt =
      seed.status === 'COMPLETED' ? new Date(seed.when.getTime() + durationMin * 60000) : null
    return prisma.job.create({
      data: {
        customerId: seed.customerId,
        vehicleId: seed.vehicleId,
        scheduledAt: seed.when,
        durationMin,
        status: seed.status,
        completedAt,
        paidAt: seed.payment ? new Date((completedAt ?? seed.when).getTime() + 3600000) : null,
        paymentMethod: seed.payment?.method ?? null,
        tipCents: seed.payment?.tipCents ?? 0,
        discountCents: seed.discountCents ?? 0,
        invoiceNumber: seed.invoiceNumber ?? null,
        invoicedAt: seed.invoiceNumber ? completedAt : null,
        notes: seed.notes ?? '',
        items: { create: lines },
      },
    })
  }

  const vehicleOf = (c: { vehicles: Array<{ id: string }> }, index = 0) => {
    const v = c.vehicles[index]
    if (!v) throw new Error('Seed customer missing vehicle')
    return v.id
  }

  const teslaJob = await makeJob({
    customerId: marcus.id,
    vehicleId: vehicleOf(marcus),
    when: at(-18, 9),
    serviceNames: ['Full Detail', 'Pet Hair Removal'],
    status: 'COMPLETED',
    payment: { method: 'CARD', tipCents: 2000 },
    invoiceNumber: 1001,
  })
  const vetteJob = await makeJob({
    customerId: hank.id,
    vehicleId: vehicleOf(hank),
    when: at(-12, 10),
    serviceNames: ['Showroom Package'],
    status: 'COMPLETED',
    payment: { method: 'ZELLE', tipCents: 4000 },
    invoiceNumber: 1002,
    notes: 'Swirl-free finish confirmed with Hank before pickup.',
  })
  const truckJob = await makeJob({
    customerId: dana.id,
    vehicleId: vehicleOf(dana, 0),
    when: at(-7, 13),
    serviceNames: ['Exterior Detail', 'Engine Bay Detail'],
    status: 'COMPLETED',
    payment: { method: 'CASH' },
  })
  await makeJob({
    customerId: priya.id,
    vehicleId: vehicleOf(priya),
    when: at(-21, 8),
    serviceNames: ['Ceramic Coating'],
    status: 'COMPLETED',
    payment: { method: 'CARD' },
  })
  // The dashboard's "needs attention" fodder: completed, unpaid, no photos.
  await makeJob({
    customerId: jess.id,
    vehicleId: vehicleOf(jess),
    when: at(-1, 14),
    serviceNames: ['Interior Deep Clean', 'Pet Hair Removal'],
    status: 'COMPLETED',
    notes: 'Will pay by Venmo this week.',
  })
  await makeJob({
    customerId: tom.id,
    vehicleId: vehicleOf(tom),
    when: at(-9, 15),
    serviceNames: ['Express Wash & Wax'],
    status: 'NO_SHOW',
  })
  await makeJob({
    customerId: dana.id,
    vehicleId: vehicleOf(dana, 1),
    when: at(-5, 9),
    serviceNames: ['Interior Deep Clean'],
    status: 'CANCELED',
  })
  // Today
  await makeJob({
    customerId: marcus.id,
    vehicleId: vehicleOf(marcus),
    when: at(0, 9),
    serviceNames: ['Express Wash & Wax'],
    status: 'IN_PROGRESS',
  })
  await makeJob({
    customerId: priya.id,
    vehicleId: vehicleOf(priya),
    when: at(0, 14),
    serviceNames: ['Exterior Detail'],
    status: 'SCHEDULED',
  })
  // Upcoming week
  await makeJob({
    customerId: jess.id,
    vehicleId: vehicleOf(jess),
    when: at(1, 10),
    serviceNames: ['Full Detail'],
    custom: [{ name: 'Extra pet hair (heavy)', priceCents: 4000, durationMin: 30 }],
    status: 'SCHEDULED',
    notes: 'Bring the good vacuum.',
  })
  await makeJob({
    customerId: hank.id,
    vehicleId: vehicleOf(hank),
    when: at(2, 9),
    serviceNames: ['Express Wash & Wax'],
    status: 'SCHEDULED',
  })
  await makeJob({
    customerId: dana.id,
    vehicleId: vehicleOf(dana, 0),
    when: at(3, 13),
    serviceNames: ['Express Wash & Wax', 'Headlight Restoration'],
    status: 'SCHEDULED',
  })
  await makeJob({
    customerId: tom.id,
    vehicleId: vehicleOf(tom),
    when: at(5, 10),
    serviceNames: ['Interior Deep Clean'],
    status: 'SCHEDULED',
    discountCents: 1500,
    notes: 'Comped $15 for the missed slot last week.',
  })

  // Photos -------------------------------------------------------------------
  console.log('Generating photos…')
  async function photograph(jobId: string, seed: number) {
    const ids: string[] = []
    for (const [index, buf] of [afterImage(seed), afterImage(seed + 10)].entries()) {
      const photo = await addPhoto({
        jobId,
        kind: 'AFTER',
        data: buf,
        originalName: `after-${index + 1}.png`,
      })
      ids.push(photo.id)
    }
    for (const [index, buf] of [beforeImage(seed), beforeImage(seed + 10)].entries()) {
      const photo = await addPhoto({
        jobId,
        kind: 'BEFORE',
        data: buf,
        originalName: `before-${index + 1}.png`,
      })
      ids.push(photo.id)
    }
    return ids // after, after, before, before
  }

  const teslaPhotos = await photograph(teslaJob.id, 1)
  const vettePhotos = await photograph(vetteJob.id, 2)
  const truckPhotos = await photograph(truckJob.id, 3)

  // Posts --------------------------------------------------------------------
  const hashtags = '#detailing #cardetailing #beforeandafter #cincinnati #shinebright'
  async function makePost(input: {
    caption: string
    platforms: Platform[]
    status: 'DRAFT' | 'SCHEDULED' | 'POSTED'
    scheduledFor?: Date
    postedAt?: Date
    jobId?: string
    photoIds: string[]
  }) {
    return prisma.socialPost.create({
      data: {
        caption: input.caption,
        platforms: input.platforms,
        status: input.status,
        scheduledFor: input.scheduledFor ?? null,
        postedAt: input.postedAt ?? null,
        jobId: input.jobId ?? null,
        photos: { create: input.photoIds.map((photoId, sort) => ({ photoId, sort })) },
      },
    })
  }

  await makePost({
    caption: `White 2021 Tesla Model 3 in for Full Detail + Pet Hair Removal — swipe for the before. ✨\n\nBook your detail in Cincinnati — link in bio.\n\n${hashtags}`,
    platforms: ['INSTAGRAM', 'FACEBOOK'],
    status: 'POSTED',
    scheduledFor: at(-17, 18),
    postedAt: at(-17, 18, 20),
    jobId: teslaJob.id,
    photoIds: teslaPhotos,
  })
  await makePost({
    caption: `That Corvette gloss. 🟡 Showroom Package: full detail + one-step polish.\n\n${hashtags}`,
    platforms: ['INSTAGRAM'],
    status: 'DRAFT',
    jobId: vetteJob.id,
    photoIds: vettePhotos.slice(0, 2),
  })
  // Overdue on purpose — the dashboard and social page flag it.
  await makePost({
    caption: `Work truck to show truck. Exterior detail + engine bay on this F-150. 🔧\n\n${hashtags}`,
    platforms: ['INSTAGRAM', 'FACEBOOK'],
    status: 'SCHEDULED',
    scheduledFor: at(-1, 17),
    jobId: truckJob.id,
    photoIds: truckPhotos,
  })
  await makePost({
    caption:
      'Weekend slots are open! Full details, ceramic coating, interior rescues — Suds has you covered. DM us or call (513) 555-0147. 🫧',
    platforms: ['INSTAGRAM', 'FACEBOOK', 'GOOGLE_BUSINESS'],
    status: 'SCHEDULED',
    scheduledFor: at(2, 18, 30),
    photoIds: [teslaPhotos[0] ?? ''].filter(Boolean),
  })

  // Caption templates --------------------------------------------------------
  await prisma.captionTemplate.createMany({
    data: [
      {
        name: 'Before / after reveal',
        body: 'Swipe ➡️ for the before. {{vehicle}} in for {{services}} at {{business}}. Book your spot in {{city}} — link in bio!',
      },
      {
        name: 'Fresh off the pad',
        body: '✨ {{services}} on this {{vehicleShort}}. That gloss speaks for itself. 📍 {{city}} · ☎ {{phone}}',
      },
      {
        name: 'Booking push',
        body: 'Slots are open this week! Full details, ceramic coating, interior rescues — {{business}} has you covered. Call {{phone}}.',
      },
      {
        name: 'Customer shoutout',
        body: 'Big thanks to {{customer}} for trusting us with their {{vehicleShort}}! {{services}} ✅',
      },
    ],
  })

  const counts = {
    users: await prisma.user.count(),
    services: await prisma.service.count(),
    customers: await prisma.customer.count(),
    jobs: await prisma.job.count(),
    photos: await prisma.photo.count(),
    posts: await prisma.socialPost.count(),
    templates: await prisma.captionTemplate.count(),
  }
  console.log('Seeded:', counts)
  console.log(`\nSign in at /login → owner@suds.local / ${password}`)
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error)
    process.exit(1)
  },
)
