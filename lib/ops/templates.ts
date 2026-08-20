import { prisma } from '@/lib/db/client'
import type { CaptionTemplate } from '@/lib/generated/prisma/client'

export async function createTemplate(input: {
  name: string
  body: string
}): Promise<CaptionTemplate> {
  return prisma.captionTemplate.create({ data: input })
}

export async function updateTemplate(
  id: string,
  input: { name: string; body: string },
): Promise<CaptionTemplate> {
  return prisma.captionTemplate.update({ where: { id }, data: input })
}

export async function deleteTemplate(id: string): Promise<void> {
  await prisma.captionTemplate.delete({ where: { id } })
}
