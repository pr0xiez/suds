import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

/**
 * Photo files live on the local filesystem under data/uploads/ (gitignored);
 * the database holds only metadata. Not serverless-safe — swap this seam for
 * object storage before deploying anywhere with an ephemeral filesystem.
 */

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads')

// Filenames are `${cuid}.${ext}` built by the app — anything else (dots,
// slashes, uppercase) is rejected so a stored name can never traverse paths.
const SAFE_FILENAME = /^[a-z0-9]+\.(jpg|png|webp|gif)$/

export function isSafeUploadFilename(filename: string): boolean {
  return SAFE_FILENAME.test(filename)
}

function resolveSafe(filename: string): string {
  if (!isSafeUploadFilename(filename)) {
    throw new Error(`Unsafe upload filename: ${JSON.stringify(filename)}`)
  }
  return path.join(UPLOADS_DIR, filename)
}

export async function saveUploadFile(filename: string, data: Buffer): Promise<void> {
  const target = resolveSafe(filename)
  await mkdir(UPLOADS_DIR, { recursive: true })
  await writeFile(target, data)
}

export async function readUploadFile(filename: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveSafe(filename))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}

export async function deleteUploadFile(filename: string): Promise<void> {
  try {
    await unlink(resolveSafe(filename))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}
