import { prisma } from '@/lib/db/client'
import { deleteUploadFile } from '@/lib/uploads'

/** Cleanup is restricted to synthetic businesses created by the smoke scripts. */
export async function cleanupFixtureBusiness(businessId: string) {
  const business = await prisma.business.findUnique({ where: { id: businessId } })
  if (!business) return
  if (business.slug !== `suds-test-${businessId}`)
    throw new Error('Refusing to delete a non-fixture business')
  const photos = await prisma.photo.findMany({ where: { businessId }, select: { filename: true } })
  for (const photo of photos) await deleteUploadFile(photo.filename)
  await prisma.booking.deleteMany({ where: { businessId } })
  await prisma.mediaUpload.deleteMany({ where: { businessId } })
  await prisma.aiRun.deleteMany({ where: { businessId } })
  await prisma.socialPost.deleteMany({ where: { businessId } })
  await prisma.photo.deleteMany({ where: { businessId } })
  await prisma.job.deleteMany({ where: { businessId } })
  await prisma.vehicle.deleteMany({ where: { businessId } })
  await prisma.customer.deleteMany({ where: { businessId } })
  await prisma.business.delete({ where: { id: businessId } })
}
