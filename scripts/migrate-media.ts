import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { prisma } from '@/lib/db/client'
import { sniffImageType } from '@/lib/images'
import { durableStorageConfigured, getObject, mediaKey, putObject } from '@/lib/storage'

// Operator CLI: local originals are retained. Default invocation is a dry run.
const apply = process.argv.includes('--apply')
async function main() {
  if (apply && !durableStorageConfigured())
    throw new Error('Configure private S3-compatible storage before applying the media migration.')
  const photos = await prisma.photo.findMany({
    select: { id: true, businessId: true, filename: true, bytes: true },
  })
  let candidates = 0
  let copied = 0
  let missing = 0
  for (const photo of photos) {
    // Flat generated filenames are the original local store; scoped keys are already migrated.
    if (!/^[a-z0-9]+\.(jpg|png|webp|gif)$/.test(photo.filename)) continue
    candidates++
    let bytes: Buffer
    try {
      const filename = path.join(process.cwd(), 'data', 'uploads', photo.filename)
      const info = await stat(filename)
      if (info.size !== photo.bytes || info.size > 10 * 1024 * 1024)
        throw new Error('Original media size did not match its saved record.')
      bytes = await readFile(filename)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
      missing++
      continue
    }
    const type = sniffImageType(bytes)
    if (!type || bytes.length !== photo.bytes || bytes.length > 10 * 1024 * 1024)
      throw new Error(`Original media validation failed for photo ${photo.id}.`)
    if (!apply) continue
    const key = mediaKey(photo.businessId, 'media', type.ext)
    await putObject(key, bytes, type.contentType)
    const stored = await getObject(key, 10 * 1024 * 1024)
    if (!stored || !bytes.equals(stored))
      throw new Error(`Stored copy verification failed for photo ${photo.id}.`)
    const changed = await prisma.photo.updateMany({
      where: { id: photo.id, businessId: photo.businessId, filename: photo.filename },
      data: { filename: key },
    })
    // Keep the verified object if commit acknowledgement is lost; never risk deleting a live pointer.
    copied += changed.count
  }
  console.log(JSON.stringify({ mode: apply ? 'apply' : 'dry-run', candidates, copied, missing }))
  if (missing) process.exitCode = 1
}
main()
  .catch(() => {
    console.error(
      'Media migration stopped. Local originals remain intact; inspect before retrying.',
    )
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
