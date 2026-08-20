import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db/client'
import type { Photo } from '@/lib/generated/prisma/client'
import type { PhotoKind } from '@/lib/generated/prisma/enums'
import { readImageDimensions, sniffImageType } from '@/lib/images'
import { deleteUploadFile, saveUploadFile } from '@/lib/uploads'

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024

/**
 * Stores the bytes under data/uploads/ and the metadata row in Photo. The type
 * comes from magic bytes, never the client's content type or file extension.
 */
export async function addPhoto(input: {
  jobId?: string | null
  kind: PhotoKind
  data: Buffer
  originalName: string
}): Promise<Photo> {
  if (input.data.length === 0) throw new Error('Empty file')
  if (input.data.length > MAX_PHOTO_BYTES) throw new Error('Photo is larger than 10 MB')
  const sniffed = sniffImageType(input.data)
  if (!sniffed) throw new Error('Not a supported image (jpeg, png, webp, or gif)')
  const dims = readImageDimensions(input.data)

  const filename = `${randomBytes(12).toString('hex')}.${sniffed.ext}`
  await saveUploadFile(filename, input.data)
  try {
    return await prisma.photo.create({
      data: {
        jobId: input.jobId ?? null,
        kind: input.kind,
        filename,
        originalName: input.originalName.slice(0, 200),
        contentType: sniffed.contentType,
        bytes: input.data.length,
        width: dims?.width ?? null,
        height: dims?.height ?? null,
      },
    })
  } catch (err) {
    await deleteUploadFile(filename)
    throw err
  }
}

export async function deletePhoto(id: string): Promise<void> {
  const photo = await prisma.photo.delete({ where: { id } })
  await deleteUploadFile(photo.filename)
}

export async function setPhotoKind(id: string, kind: PhotoKind): Promise<Photo> {
  return prisma.photo.update({ where: { id }, data: { kind } })
}
