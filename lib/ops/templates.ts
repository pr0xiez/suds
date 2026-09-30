import { prisma } from '@/lib/db/client'
import type { CaptionTemplate } from '@/lib/generated/prisma/client'

export async function createTemplate(
  businessId: string,
  input: {
    name: string
    body: string
  },
): Promise<CaptionTemplate> {
  return prisma.captionTemplate.create({ data: { ...input, businessId } })
}

export async function updateTemplate(
  businessId: string,
  id: string,
  input: { name: string; body: string },
): Promise<CaptionTemplate> {
  return prisma.captionTemplate.update({
    where: { businessId_id: { businessId, id } },
    data: input,
  })
}

export async function deleteTemplate(businessId: string, id: string): Promise<void> {
  await prisma.captionTemplate.delete({ where: { businessId_id: { businessId, id } } })
}
