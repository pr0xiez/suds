'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { requireOwner, requireUser } from '@/lib/auth/session'
import { fdString, friendlyError } from '@/lib/forms'
import { parseMoneyToCents } from '@/lib/money'
import { createService, deleteService, updateService } from '@/lib/ops/services'
import { updateSettings } from '@/lib/ops/settings'
import { createTemplate, deleteTemplate, updateTemplate } from '@/lib/ops/templates'
import { createUser, resetUserPassword, setUserActive, setUserRole } from '@/lib/ops/users'

// ---------------------------------------------------------------------------
// Business settings
// ---------------------------------------------------------------------------

function validTimezone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz })
    return true
  } catch {
    return false
  }
}

export async function updateSettingsAction(fd: FormData): Promise<void> {
  await requireUser()
  const timezone = fdString(fd, 'timezone').trim() || 'America/New_York'
  if (!validTimezone(timezone)) {
    redirect(`/settings?error=${encodeURIComponent(`Unknown timezone: ${timezone}`)}`)
  }
  await updateSettings({
    businessName: fdString(fd, 'businessName').trim().slice(0, 200),
    phone: fdString(fd, 'phone').trim().slice(0, 50),
    email: fdString(fd, 'email').trim().slice(0, 200),
    address: fdString(fd, 'address').trim().slice(0, 500),
    city: fdString(fd, 'city').trim().slice(0, 100),
    timezone,
    instagramHandle: fdString(fd, 'instagramHandle').trim().replace(/^@/, '').slice(0, 100),
    facebookPage: fdString(fd, 'facebookPage').trim().slice(0, 200),
    tiktokHandle: fdString(fd, 'tiktokHandle').trim().replace(/^@/, '').slice(0, 100),
    googleReviewUrl: fdString(fd, 'googleReviewUrl').trim().slice(0, 500),
    hashtags: fdString(fd, 'hashtags').trim().slice(0, 1000),
  })
  revalidatePath('/', 'layout')
  redirect('/settings?saved=1')
}

// ---------------------------------------------------------------------------
// Service catalog
// ---------------------------------------------------------------------------

const CATEGORIES = ['EXTERIOR', 'INTERIOR', 'FULL', 'ADDON'] as const

function readService(fd: FormData) {
  const priceCents = parseMoneyToCents(fdString(fd, 'price'))
  if (priceCents === null) throw new Error('Enter a price like 150 or 149.99')
  const durationMin = Number(fdString(fd, 'durationMin'))
  if (!Number.isInteger(durationMin) || durationMin < 0 || durationMin > 24 * 60) {
    throw new Error('Duration must be minutes between 0 and 1440')
  }
  const name = fdString(fd, 'name').trim()
  if (!name) throw new Error('Name is required')
  const sort = Number(fdString(fd, 'sort') || '0')
  return {
    name: name.slice(0, 200),
    description: fdString(fd, 'description').trim().slice(0, 2000),
    category: z.enum(CATEGORIES).parse(fdString(fd, 'category')),
    priceCents,
    durationMin,
    active: fdString(fd, 'active') === 'on',
    sort: Number.isInteger(sort) ? sort : 0,
  }
}

async function runServicesMutation(mutate: () => Promise<unknown>): Promise<void> {
  let error: string | null = null
  try {
    await mutate()
  } catch (err) {
    error = friendlyError(err)
  }
  revalidatePath('/', 'layout')
  redirect(error ? `/settings/services?error=${encodeURIComponent(error)}` : '/settings/services')
}

export async function createServiceAction(fd: FormData): Promise<void> {
  await requireUser()
  await runServicesMutation(() => createService(readService(fd)))
}

export async function updateServiceAction(fd: FormData): Promise<void> {
  await requireUser()
  await runServicesMutation(() => updateService(fdString(fd, 'id'), readService(fd)))
}

export async function deleteServiceAction(fd: FormData): Promise<void> {
  await requireUser()
  await runServicesMutation(() => deleteService(fdString(fd, 'id')))
}

// ---------------------------------------------------------------------------
// Caption templates
// ---------------------------------------------------------------------------

function readTemplate(fd: FormData) {
  const name = fdString(fd, 'name').trim()
  const body = fdString(fd, 'body').trim()
  if (!name) throw new Error('Template name is required')
  if (!body) throw new Error('Template body is required')
  return { name: name.slice(0, 200), body: body.slice(0, 4000) }
}

async function runTemplatesMutation(mutate: () => Promise<unknown>): Promise<void> {
  let error: string | null = null
  try {
    await mutate()
  } catch (err) {
    error = friendlyError(err)
  }
  revalidatePath('/', 'layout')
  redirect(error ? `/settings/templates?error=${encodeURIComponent(error)}` : '/settings/templates')
}

export async function createTemplateAction(fd: FormData): Promise<void> {
  await requireUser()
  await runTemplatesMutation(() => createTemplate(readTemplate(fd)))
}

export async function updateTemplateAction(fd: FormData): Promise<void> {
  await requireUser()
  await runTemplatesMutation(() => updateTemplate(fdString(fd, 'id'), readTemplate(fd)))
}

export async function deleteTemplateAction(fd: FormData): Promise<void> {
  await requireUser()
  await runTemplatesMutation(() => deleteTemplate(fdString(fd, 'id')))
}

// ---------------------------------------------------------------------------
// Users — owner only
// ---------------------------------------------------------------------------

const ROLES = ['OWNER', 'STAFF'] as const

async function runUsersMutation(mutate: () => Promise<unknown>): Promise<void> {
  let error: string | null = null
  try {
    await mutate()
  } catch (err) {
    error = friendlyError(err)
  }
  revalidatePath('/', 'layout')
  redirect(error ? `/settings/users?error=${encodeURIComponent(error)}` : '/settings/users')
}

export async function createUserAction(fd: FormData): Promise<void> {
  await requireOwner()
  await runUsersMutation(() =>
    createUser({
      email: z.email('Enter a valid email').parse(fdString(fd, 'email').trim()),
      name: fdString(fd, 'name').trim() || fdString(fd, 'email').trim(),
      password: fdString(fd, 'password'),
      role: z.enum(ROLES).parse(fdString(fd, 'role')),
    }),
  )
}

export async function setUserActiveAction(fd: FormData): Promise<void> {
  await requireOwner()
  await runUsersMutation(() => setUserActive(fdString(fd, 'id'), fdString(fd, 'active') === '1'))
}

export async function setUserRoleAction(fd: FormData): Promise<void> {
  await requireOwner()
  await runUsersMutation(() =>
    setUserRole(fdString(fd, 'id'), z.enum(ROLES).parse(fdString(fd, 'role'))),
  )
}

export async function resetUserPasswordAction(fd: FormData): Promise<void> {
  await requireOwner()
  await runUsersMutation(() => resetUserPassword(fdString(fd, 'id'), fdString(fd, 'password')))
}
