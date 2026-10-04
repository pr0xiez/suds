'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { inviteCustomerPortal } from '@/lib/auth/accounts'
import { consumeRateLimit } from '@/lib/auth/persistentRateLimit'
import { requireOwner, requireUser } from '@/lib/auth/session'
import { fdString, friendlyError } from '@/lib/forms'
import {
  addVehicle,
  createCustomer,
  deleteCustomer,
  deleteVehicle,
  updateCustomer,
  updateVehicle,
} from '@/lib/ops/customers'

const customerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  phone: z.string().trim().max(50),
  email: z.string().trim().max(200),
  address: z.string().trim().max(500),
  notes: z.string().trim().max(5000),
})

function readCustomer(fd: FormData) {
  return customerSchema.parse({
    name: fdString(fd, 'name'),
    phone: fdString(fd, 'phone'),
    email: fdString(fd, 'email'),
    address: fdString(fd, 'address'),
    notes: fdString(fd, 'notes'),
  })
}

const vehicleSchema = z.object({
  year: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : Number(value)))
    .refine(
      (value) => value === null || (Number.isInteger(value) && value >= 1900 && value <= 2100),
      {
        message: 'Year must be between 1900 and 2100',
      },
    ),
  make: z.string().trim().min(1, 'Make is required').max(100),
  model: z.string().trim().min(1, 'Model is required').max(100),
  color: z.string().trim().max(50),
  plate: z.string().trim().max(20),
  notes: z.string().trim().max(2000),
})

function readVehicle(fd: FormData) {
  return vehicleSchema.parse({
    year: fdString(fd, 'year'),
    make: fdString(fd, 'make'),
    model: fdString(fd, 'model'),
    color: fdString(fd, 'color'),
    plate: fdString(fd, 'plate'),
    notes: fdString(fd, 'notes'),
  })
}

export async function createCustomerAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const customer = await createCustomer(user.businessId, readCustomer(fd))
  revalidatePath('/', 'layout')
  redirect(`/customers/${customer.id}`)
}

export async function updateCustomerAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const id = fdString(fd, 'id')
  await updateCustomer(user.businessId, id, readCustomer(fd))
  revalidatePath('/', 'layout')
  redirect(`/customers/${id}?saved=1`)
}

export async function deleteCustomerAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const id = fdString(fd, 'id')
  const result = await deleteCustomer(user.businessId, id)
  revalidatePath('/', 'layout')
  if (result.error) redirect(`/customers/${id}?error=${encodeURIComponent(result.error)}`)
  redirect('/customers')
}

export async function addVehicleAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const customerId = fdString(fd, 'customerId')
  await addVehicle(user.businessId, customerId, readVehicle(fd))
  revalidatePath('/', 'layout')
  redirect(`/customers/${customerId}`)
}

export async function updateVehicleAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const customerId = fdString(fd, 'customerId')
  await updateVehicle(user.businessId, fdString(fd, 'id'), readVehicle(fd))
  revalidatePath('/', 'layout')
  redirect(`/customers/${customerId}`)
}

export async function deleteVehicleAction(fd: FormData): Promise<void> {
  const user = await requireUser()
  const customerId = fdString(fd, 'customerId')
  let error: string | null = null
  try {
    const result = await deleteVehicle(user.businessId, fdString(fd, 'id'))
    error = result.error ?? null
  } catch (err) {
    error = friendlyError(err)
  }
  revalidatePath('/', 'layout')
  if (error) redirect(`/customers/${customerId}?error=${encodeURIComponent(error)}`)
  redirect(`/customers/${customerId}`)
}

export async function inviteCustomerPortalAction(fd: FormData): Promise<void> {
  const user = await requireOwner()
  const id = fdString(fd, 'id')
  let error: string | null = null
  try {
    if (!(await consumeRateLimit(`customer-invite:${user.businessId}`, 60, 24 * 60 * 60_000)))
      throw new Error('Too many portal invitations today. Try again tomorrow.')
    await inviteCustomerPortal(user.businessId, id)
  } catch (err) {
    error = friendlyError(err)
  }
  revalidatePath('/', 'layout')
  if (error) redirect(`/customers/${id}?error=${encodeURIComponent(error)}`)
  redirect(`/customers/${id}?invited=1`)
}
