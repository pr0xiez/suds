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

export async function createCustomer(businessId: string, input: CustomerInput): Promise<Customer> {
  return prisma.customer.create({ data: { ...input, businessId } })
}

export async function updateCustomer(
  businessId: string,
  id: string,
  input: CustomerInput,
): Promise<Customer> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Customer" WHERE "businessId" = ${businessId} AND "id" = ${id} FOR UPDATE`
      const current = await tx.customer.findUniqueOrThrow({
        where: { businessId_id: { businessId, id } },
      })
      if (current.email.trim().toLowerCase() !== input.email.trim().toLowerCase()) {
        const tokens = await tx.accountToken.findMany({
          where: { businessId, customerId: id, purpose: 'CUSTOMER_LINK', consumedAt: null },
          select: { id: true },
        })
        await tx.accountToken.updateMany({
          where: { id: { in: tokens.map((token) => token.id) } },
          data: { consumedAt: new Date() },
        })
        await tx.notificationOutbox.updateMany({
          where: {
            dedupeKey: { in: tokens.map((token) => `account:${token.id}`) },
            status: { in: ['PENDING', 'PROCESSING'] },
          },
          data: { status: 'CANCELED', lockedAt: null },
        })
      }
      return tx.customer.update({ where: { businessId_id: { businessId, id } }, data: input })
    },
    { timeout: 20_000 },
  )
}

/**
 * Deleting a customer is refused while jobs exist — job history is business
 * history (revenue, invoices) and must go deliberately, job by job.
 */
export async function deleteCustomer(businessId: string, id: string): Promise<{ error?: string }> {
  const jobCount = await prisma.job.count({ where: { businessId, customerId: id } })
  if (jobCount > 0) {
    return { error: `Customer has ${jobCount} job(s). Delete those first.` }
  }
  await prisma.customer.delete({ where: { businessId_id: { businessId, id } } })
  return {}
}

export async function addVehicle(
  businessId: string,
  customerId: string,
  input: VehicleInput,
): Promise<Vehicle> {
  await prisma.customer.findUniqueOrThrow({
    where: { businessId_id: { businessId, id: customerId } },
  })
  return prisma.vehicle.create({ data: { ...input, customerId, businessId } })
}

export async function updateVehicle(
  businessId: string,
  id: string,
  input: VehicleInput,
): Promise<Vehicle> {
  return prisma.vehicle.update({ where: { businessId_id: { businessId, id } }, data: input })
}

export async function deleteVehicle(businessId: string, id: string): Promise<{ error?: string }> {
  const jobCount = await prisma.job.count({ where: { businessId, vehicleId: id } })
  if (jobCount > 0) {
    return { error: `Vehicle is on ${jobCount} job(s). Delete those first.` }
  }
  await prisma.vehicle.delete({ where: { businessId_id: { businessId, id } } })
  return {}
}
