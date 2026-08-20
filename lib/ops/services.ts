import { prisma } from '@/lib/db/client'
import type { Service } from '@/lib/generated/prisma/client'
import type { ServiceCategory } from '@/lib/generated/prisma/enums'

export interface ServiceInput {
  name: string
  description: string
  category: ServiceCategory
  priceCents: number
  durationMin: number
  active: boolean
  sort: number
}

export async function createService(input: ServiceInput): Promise<Service> {
  return prisma.service.create({ data: input })
}

export async function updateService(id: string, input: ServiceInput): Promise<Service> {
  return prisma.service.update({ where: { id }, data: input })
}

/**
 * Deleting a service is safe for history: job lines snapshot name/price/duration
 * at booking time and only carry serviceId as a soft link (SetNull on delete).
 */
export async function deleteService(id: string): Promise<void> {
  await prisma.service.delete({ where: { id } })
}

export async function activeServices(): Promise<Service[]> {
  return prisma.service.findMany({
    where: { active: true },
    orderBy: [{ sort: 'asc' }, { name: 'asc' }],
  })
}
