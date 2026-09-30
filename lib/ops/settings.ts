import { prisma } from '@/lib/db/client'
import type { Prisma, Settings } from '@/lib/generated/prisma/client'

/** Settings belong to exactly one business, never a shared singleton. */
export async function getSettings(businessId: string): Promise<Settings> {
  return prisma.settings.upsert({ where: { businessId }, update: {}, create: { businessId } })
}

export async function updateSettings(
  businessId: string,
  data: Prisma.SettingsUpdateInput,
): Promise<Settings> {
  return prisma.$transaction(async (tx) => {
    await tx.settings.upsert({ where: { businessId }, update: {}, create: { businessId } })
    const settings = await tx.settings.update({ where: { businessId }, data })
    await tx.business.update({ where: { id: businessId }, data: { name: settings.businessName } })
    return settings
  })
}
