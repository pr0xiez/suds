/** Bound JSON even for chunked requests with no Content-Length header. */
export async function readMediaJson(req: Request, maxBytes = 16 * 1024): Promise<unknown> {
  if (!req.body) throw new Error('A request body is required.')
  const reader = req.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      size += chunk.value.byteLength
      if (size > maxBytes) {
        await reader.cancel()
        throw new Error('This request is too large.')
      }
      chunks.push(chunk.value)
    }
  } finally {
    reader.releaseLock()
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}
