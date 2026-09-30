/** Only small authorization/finalization JSON crosses the app; media goes directly to storage. */
export async function uploadDirectMedia(
  file: File,
  options: {
    kind: 'PHOTO' | 'VIDEO'
    jobId?: string
    photoKind?: string
    approvedForMarketing?: boolean
  },
) {
  const response = await fetch('/api/media/uploads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...options,
      originalName: file.name,
      contentType: file.type || (/\.mov$/i.test(file.name) ? 'video/quicktime' : 'video/mp4'),
      sizeBytes: file.size,
    }),
  })
  const prepared = await response.json()
  if (!response.ok) throw new Error(prepared.error ?? 'Could not prepare your upload.')
  const transfer = await fetch(prepared.url, {
    method: 'PUT',
    headers: prepared.headers,
    body: file,
  })
  if (!transfer.ok)
    throw new Error('Could not upload your file. Check your connection and try again.')
  const finalize = await fetch(`/api/media/uploads/${encodeURIComponent(prepared.id)}/finalize`, {
    method: 'POST',
  })
  const result = await finalize.json()
  if (!finalize.ok) throw new Error(result.error ?? 'Could not finalize your upload.')
  return result as { id: string; photoId?: string; status: string }
}
