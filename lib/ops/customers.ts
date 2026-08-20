import { prisma } from '@/lib/db/client'
import type { Customer, Vehicle } from '@/lib/generated/prisma/client'

export interface CustomerInput {
  name: string
  phone: string
  email: string
  address: string
  notes: string
}

export interface VehicleInput {
  year: number | null
  make: string
  model: string
  color: string
  plate: string
  notes: string
}

export async function createCustomer(input: CustomerInput): Promise<Customer> {
  return prisma.customer.create({ data: input })
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<Customer> {
  return prisma.customer.update({ where: { id }, data: input })
}

/**
 * Deleting a customer is refused while jobs exist — job history is business
 * history (revenue, invoices) and must go deliberately, job by job.
 */
export async function deleteCustomer(id: string): Promise<{ error?: string }> {
  const jobCount = await prisma.job.count({ where: { customerId: id } })
  if (jobCount > 0) {
    return { error: `Customer has ${jobCount} job(s). Delete those first.` }
  }
  await prisma.customer.delete({ where: { id } })
  return {}
}

export async function addVehicle(customerId: string, input: VehicleInput): Promise<Vehicle> {
  return prisma.vehicle.create({ data: { ...input, customerId } })
}

export async function updateVehicle(id: string, input: VehicleInput): Promise<Vehicle> {
  return prisma.vehicle.update({ where: { id }, data: input })
}

export async function deleteVehicle(id: string): Promise<{ error?: string }> {
  const jobCount = await prisma.job.count({ where: { vehicleId: id } })
  if (jobCount > 0) {
    return { error: `Vehicle is on ${jobCount} job(s). Delete those first.` }
  }
  await prisma.vehicle.delete({ where: { id } })
  return {}
}
