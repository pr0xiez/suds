'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireUser } from '@/lib/auth/session'
import { parseDatetimeLocal } from '@/lib/dates'
import { fdString, fdStrings, friendlyError, safeBackPath } from '@/lib/forms'
import { parseMoneyToCents } from '@/lib/money'
import {
  clearPayment,
  createJob,
  deleteJob,
  ensureInvoice,
  type JobInput,
  recordPayment,
  setJobStatus,
  updateJob,
} from '@/lib/ops/jobs'
import { getSettings } from '@/lib/ops/settings'
import { createPostFromJob } from '@/lib/ops/social'

export interface FormState {
  error: string
}

const JOB_STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW'] as const
const PAYMENT_METHODS = ['CASH', 'CARD', 'VENMO', 'CASHAPP', 'ZELLE', 'OTHER'] as const

const customLineSchema = z.object({
  name: z.string().trim().min(1, 'Line items need a name').max(200),
  price: z.string(),
  durationMin: z.coerce
    .number()
    .int()
    .min(0)
    .max(24 * 60),
})

function readJobInput(fd: FormData, timezone: string): JobInput {
  const scheduledAt = parseDatetimeLocal(fdString(fd, 'scheduledAt'), timezone)
  if (!scheduledAt) throw new Error('Pick a date and time')

  const rawLines = fdString(fd, 'customLines') || '[]'
  let parsedLines: unknown
  try {
    parsedLines = JSON.parse(rawLines)
  } catch {
    throw new Error('Custom lines are malformed')
  }
  const customLines = z
    .array(customLineSchema)
    .max(20)
    .parse(parsedLines)
    .map((line) => {
      const priceCents = parseMoneyToCents(line.price)
      if (priceCents === null) throw new Error(`"${line.name}": enter a price like 40 or 39.99`)
      return { name: line.name, priceCents, durationMin: line.durationMin }
    })

  const durationRaw = fdString(fd, 'durationMin').trim()
  const durationMin = durationRaw === '' ? null : Number(durationRaw)
  if (
    durationMin !== null &&
    (!Number.isInteger(durationMin) || durationMin < 15 || durationMin > 24 * 60)
  ) {
    throw new Error('Duration override must be between 15 and 1440 minutes')
  }

  const discountRaw = fdString(fd, 'discount').trim()
  const discountCents = discountRaw === '' ? 0 : parseMoneyToCents(discountRaw)
  if (discountCents === null) throw new Error('Enter a discount like 25 or 12.50')

  return {
    customerId: fdString(fd, 'customerId'),
    vehicleId: fdString(fd, 'vehicleId'),
    scheduledAt,
    serviceIds: fdStrings(fd, 'serviceIds'),
    customLines,
    durationMin,
    notes: fdString(fd, 'notes').trim().slice(0, 5000),
    internalNotes: fdString(fd, 'internalNotes').trim().slice(0, 5000),
    discountCents,
  }
}

/** Create/update from the JobForm client component (useActionState). */
export async function saveJobAction(_prev: FormState | null, fd: FormData): Promise<FormState> {
  const user = await requireUser()
  const settings = await getSettings(user.businessId)
  const jobId = fdString(fd, 'jobId')
  let savedId: string
  try {
    const input = readJobInput(fd, settings.timezone)
    if (!input.customerId) return { error: 'Pick a customer' }
    if (!input.vehicleId) return { error: 'Pick a vehicle' }
    const job = jobId
      ? await updateJob(user.businessId, jobId, input)
      : await createJob(user.businessId, input)
    savedId = job.id
  } catch (err) {
    return { error: friendlyError(err) }
  }
  revalidatePath('/', 'layout')
  redirect(`/jobs/${savedId}`)
}

export async function setJobStatusAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const id = fdString(fd, 'id')
  const status = z.enum(JOB_STATUSES).parse(fdString(fd, 'status'))
  const back = safeBackPath(fdString(fd, 'back'), `/jobs/${id}`)
  let error: string | null = null
  try {
    await setJobStatus(user.businessId, id, status)
  } catch (err) {
    error = friendlyError(err)
  }
  revalidatePath('/', 'layout')
  redirect(error ? `${back}?error=${encodeURIComponent(error)}` : back)
}

export async function recordPaymentAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const id = fdString(fd, 'id')
  const method = z.enum(PAYMENT_METHODS).parse(fdString(fd, 'method'))
  const tipRaw = fdString(fd, 'tip').trim()
  const tipCents = tipRaw === '' ? 0 : parseMoneyToCents(tipRaw)
  let error: string | null = null
  if (tipCents === null) {
    error = 'Enter a tip like 20 or 12.50'
  } else {
    try {
      await recordPayment(user.businessId, id, { method, tipCents })
    } catch (err) {
      error = friendlyError(err)
    }
  }
  revalidatePath('/', 'layout')
  redirect(error ? `/jobs/${id}?error=${encodeURIComponent(error)}` : `/jobs/${id}`)
}

export async function clearPaymentAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const id = fdString(fd, 'id')
  let error: string | null = null
  try {
    await clearPayment(user.businessId, id)
  } catch (err) {
    error = friendlyError(err)
  }
  revalidatePath('/', 'layout')
  redirect(error ? `/jobs/${id}?error=${encodeURIComponent(error)}` : `/jobs/${id}`)
}

export async function generateInvoiceAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const id = fdString(fd, 'id')
  await ensureInvoice(user.businessId, id)
  revalidatePath('/', 'layout')
  redirect(`/jobs/${id}/invoice`)
}

export async function deleteJobAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  await deleteJob(user.businessId, fdString(fd, 'id'))
  revalidatePath('/', 'layout')
  redirect('/jobs')
}

/** The job → social bridge: builds a draft post and lands in the composer. */
export async function createPostFromJobAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const post = await createPostFromJob(user.businessId, fdString(fd, 'id'))
  revalidatePath('/', 'layout')
  redirect(`/social/${post.id}`)
}
