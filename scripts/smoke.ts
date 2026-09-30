import { randomBytes } from 'node:crypto'
import { addDays, todayWall, wallTimeToUtc } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { jobTotalCents } from '@/lib/money'
import { addVehicle, createCustomer, deleteCustomer, deleteVehicle } from '@/lib/ops/customers'
import {
  createJob,
  deleteJob,
  ensureInvoice,
  recordPayment,
  setJobStatus,
  updateJob,
} from '@/lib/ops/jobs'
import { addPhoto } from '@/lib/ops/photos'
import { createService, deleteService } from '@/lib/ops/services'
import { getSettings } from '@/lib/ops/settings'
import { createPostFromJob, deletePost, markPosted, schedulePost } from '@/lib/ops/social'
import { encodePng } from '@/lib/png'
import { readUploadFile } from '@/lib/uploads'
import { cleanupFixtureBusiness } from './fixtures'

/**
 * End-to-end exercise of the ops layer against the real database — the flows a
 * click can't be scripted for. Creates its own records and removes them, so it
 * is safe to run against a seeded dev database.
 */

const businessId = `smoke${randomBytes(8).toString('hex')}`
let step = ''
function log(next: string) {
  step = next
  console.log(`  · ${next}`)
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`${step}: ${message}`)
}

async function main() {
  console.log('suds smoke — ops against the dev database\n')

  await prisma.business.create({
    data: {
      id: businessId,
      slug: `suds-test-${businessId}`,
      name: 'Smoke Test',
      settings: { create: { timezone: 'America/New_York', travelBufferMin: 0 } },
    },
  })
  log('settings')
  const settings = await getSettings(businessId)
  assert(settings.businessId === businessId, 'business settings missing')
  const tz = settings.timezone

  log('customer + vehicle')
  const customer = await createCustomer(businessId, {
    name: 'Smoke Test',
    phone: '(000) 000-0000',
    email: 'smoke@example.com',
    address: '',
    notes: 'created by scripts/smoke.ts — safe to delete',
  })
  const vehicle = await addVehicle(businessId, customer.id, {
    year: 2020,
    make: 'Mazda',
    model: 'MX-5',
    color: 'Gray',
    plate: '',
    notes: '',
  })

  log('service')
  const service = await createService(businessId, {
    name: 'Smoke Detail',
    description: '',
    category: 'EXTERIOR',
    priceCents: 12300,
    durationMin: 90,
    active: true,
    sort: 999,
  })

  log('create job (catalog snapshot + custom line)')
  const when = wallTimeToUtc({ ...addDays(todayWall(tz), 1), hour: 11, minute: 30 }, tz)
  const job = await createJob(businessId, {
    customerId: customer.id,
    vehicleId: vehicle.id,
    scheduledAt: when,
    serviceIds: [service.id],
    customLines: [{ name: 'Bug removal', priceCents: 2500, durationMin: 15 }],
    durationMin: null,
    notes: '',
    internalNotes: '',
    discountCents: 800,
  })
  const jobFull = await prisma.job.findUniqueOrThrow({
    where: { id: job.id },
    include: { items: true },
  })
  assert(jobFull.items.length === 2, `expected 2 items, got ${jobFull.items.length}`)
  assert(jobFull.durationMin === 105, `expected derived duration 105, got ${jobFull.durationMin}`)
  assert(jobTotalCents(jobFull) === 12300 + 2500 - 800, `total mismatch: ${jobTotalCents(jobFull)}`)

  log('customer delete refused while jobs exist')
  const refusal = await deleteCustomer(businessId, customer.id)
  assert(refusal.error, 'delete should have been refused')

  log('status transitions')
  await setJobStatus(businessId, job.id, 'IN_PROGRESS')
  const completed = await setJobStatus(businessId, job.id, 'COMPLETED')
  assert(completed.completedAt !== null, 'completedAt not set')
  let threw = false
  try {
    await setJobStatus(businessId, job.id, 'IN_PROGRESS')
  } catch {
    threw = true
  }
  assert(threw, 'COMPLETED → IN_PROGRESS should be rejected')

  log('payment')
  const paid = await recordPayment(businessId, job.id, { method: 'VENMO', tipCents: 1500 })
  assert(paid.paidAt !== null && paid.tipCents === 1500, 'payment not recorded')

  log('invoice numbering is stable')
  const first = await ensureInvoice(businessId, job.id)
  const second = await ensureInvoice(businessId, job.id)
  assert(first === second, `invoice number changed: ${first} → ${second}`)

  log('photo upload (generated PNG, dimensions parsed)')
  const png = encodePng(320, 240, (x, y) => [x % 256, y % 256, 128])
  const before = await addPhoto(businessId, {
    jobId: job.id,
    kind: 'BEFORE',
    data: png,
    originalName: 'b.png',
  })
  const after = await addPhoto(businessId, {
    jobId: job.id,
    kind: 'AFTER',
    data: png,
    originalName: 'a.png',
  })
  assert(before.width === 320 && before.height === 240, 'dimensions not parsed')
  assert((await readUploadFile(before.filename)) !== null, 'file missing on disk')
  let rejected = false
  try {
    await addPhoto(businessId, {
      jobId: job.id,
      kind: 'OTHER',
      data: Buffer.from('not an image'),
      originalName: 'x.txt',
    })
  } catch {
    rejected = true
  }
  assert(rejected, 'non-image upload should be rejected')

  await prisma.photo.updateMany({
    where: { businessId, id: { in: [before.id, after.id] } },
    data: { approvedForMarketing: true },
  })
  log('post from job (after leads, caption suggested)')
  const post = await createPostFromJob(businessId, job.id)
  const postFull = await prisma.socialPost.findUniqueOrThrow({
    where: { id: post.id },
    include: { photos: { include: { photo: true }, orderBy: { sort: 'asc' } } },
  })
  assert(postFull.photos.length === 2, 'post should carry both photos')
  assert(postFull.photos[0]?.photo.id === after.id, 'AFTER photo should lead')
  assert(postFull.caption.length > 0, 'caption should be suggested')

  log('schedule + mark posted')
  await schedulePost(
    businessId,
    post.id,
    wallTimeToUtc({ ...addDays(todayWall(tz), 2), hour: 18, minute: 0 }, tz),
  )
  const posted = await markPosted(businessId, post.id)
  assert(posted.status === 'POSTED' && posted.postedAt !== null, 'markPosted failed')

  log('update job (reschedule + re-snapshot)')
  await updateJob(businessId, job.id, {
    customerId: customer.id,
    vehicleId: vehicle.id,
    scheduledAt: new Date(when.getTime() + 3600000),
    serviceIds: [service.id],
    customLines: [],
    durationMin: 120,
    notes: 'rescheduled',
    internalNotes: '',
    discountCents: 0,
  })
  const updated = await prisma.job.findUniqueOrThrow({
    where: { id: job.id },
    include: { items: true },
  })
  assert(updated.items.length === 1 && updated.durationMin === 120, 'update did not replace items')

  log('cleanup')
  await deletePost(businessId, post.id)
  const beforeFilename = before.filename
  await deleteJob(businessId, job.id)
  assert(
    (await readUploadFile(beforeFilename)) === null,
    'photo file should be gone after job delete',
  )
  await deleteVehicle(businessId, vehicle.id)
  const finalDelete = await deleteCustomer(businessId, customer.id)
  assert(!finalDelete.error, 'customer delete should succeed once jobs are gone')
  await deleteService(businessId, service.id)

  console.log('\nPASS — all smoke steps green')
}

main().then(
  async () => {
    await cleanupFixtureBusiness(businessId)
    await prisma.$disconnect()
  },
  async (error) => {
    console.error('\nFAIL:', error)
    try {
      await cleanupFixtureBusiness(businessId)
    } finally {
      await prisma.$disconnect()
      process.exitCode = 1
    }
  },
)
