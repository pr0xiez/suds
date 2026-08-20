import { prisma } from '@/lib/db/client'
import type { Prisma, Settings } from '@/lib/generated/prisma/client'

/** The singleton Settings row (id 1), created on first read. */
export async function getSettings(): Promise<Settings> {
  return prisma.settings.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } })
}

export async function updateSettings(data: Prisma.SettingsUpdateInput): Promise<Settings> {
  await getSettings()
  return prisma.settings.update({ where: { id: 1 }, data })
}
