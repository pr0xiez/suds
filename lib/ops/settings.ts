import { lockBusinessSchedule } from '@/lib/bookingSchedule'
import { prisma } from '@/lib/db/client'
import { TX_OPTS } from '@/lib/db/txOptions'
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
    // Business row before Settings, the order saveBookingSetup and every calendar writer use.
    // The timezone also shapes availability, so this serializes with bookings too.
    await lockBusinessSchedule(tx, businessId)
    await tx.settings.upsert({ where: { businessId }, update: {}, create: { businessId } })
    const settings = await tx.settings.update({ where: { businessId }, data })
    await tx.business.update({ where: { id: businessId }, data: { name: settings.businessName } })
    return settings
  }, TX_OPTS)
}
