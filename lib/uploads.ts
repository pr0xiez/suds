import { deleteObject, getObject, isSafeObjectKey, putObject } from '@/lib/storage'

// Legacy filenames remain readable after migration; new uploads use business-scoped keys.
export const isSafeUploadFilename = isSafeObjectKey
export async function saveUploadFile(filename: string, data: Buffer): Promise<void> {
  await putObject(filename, data)
}
export async function readUploadFile(filename: string): Promise<Buffer | null> {
  return getObject(filename, 10 * 1024 * 1024)
}
export async function deleteUploadFile(filename: string): Promise<void> {
  await deleteObject(filename)
}
