import { createHash, createHmac, randomBytes } from 'node:crypto'
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'

/** Private, provider-flexible S3 storage. Credentials never leave the server. */
export type S3Config = {
  endpoint: string
  bucket: string
  region: string
  accessKey: string
  secretKey: string
}
const encode = (value: string) =>
  encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  )
const hash = (value: string) => createHash('sha256').update(value).digest('hex')
const hmac = (key: string | Buffer, value: string) =>
  createHmac('sha256', key).update(value).digest()
export function s3Config(): S3Config {
  const config = {
    endpoint: process.env.S3_ENDPOINT ?? '',
    bucket: process.env.S3_BUCKET ?? '',
    region: process.env.S3_REGION ?? 'auto',
    accessKey: process.env.S3_ACCESS_KEY_ID ?? '',
    secretKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
  }
  if (!config.bucket || !config.accessKey || !config.secretKey)
    throw new Error('Media storage is not connected.')
  const url = new URL(config.endpoint)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash)
    throw new Error('Storage endpoint must be HTTPS.')
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(config.bucket))
    throw new Error('Invalid storage bucket.')
  return config
}
export function durableStorageConfigured() {
  if (process.env.STORAGE_DRIVER !== 's3') return false
  try {
    s3Config()
    return true
  } catch {
    return false
  }
}
function localAllowed() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Production requires durable S3-compatible media storage.')
}
export function isSafeObjectKey(key: string) {
  return (
    /^pending\/business\/[a-z0-9-]+\/[a-z0-9]+\.(jpg|png|webp|gif|mp4|mov)$/.test(key) ||
    /^business\/[a-z0-9-]+\/(pending|media|renders)\/[a-z0-9]+\.(jpg|png|webp|gif|mp4|mov)$/.test(
      key,
    ) ||
    /^[a-z0-9]+\.(jpg|png|webp|gif)$/.test(key)
  )
}
function assertKey(key: string) {
  if (!isSafeObjectKey(key)) throw new Error('Unsafe media key.')
}
/** Accepted objects have no browser write capability; pending/ gets a one-day bucket lifecycle rule. */
export function acceptedMediaKey(pendingKey: string) {
  assertKey(pendingKey)
  if (pendingKey.startsWith('pending/business/'))
    return pendingKey.replace(/^pending\/business\/([^/]+)\//, 'business/$1/media/')
  if (pendingKey.includes('/pending/')) return pendingKey.replace('/pending/', '/media/')
  throw new Error('This object is not a staging upload.')
}
export function mediaKey(businessId: string, group: 'pending' | 'media' | 'renders', ext: string) {
  const prefix =
    group === 'pending' ? `pending/business/${businessId}` : `business/${businessId}/${group}`
  const key = `${prefix}/${randomBytes(18).toString('hex')}.${ext}`
  assertKey(key)
  return key
}
/** AWS documented SigV4 query signing; deterministic fixture exercised in storage.test.ts. */
export function signS3Url(
  config: S3Config,
  key: string,
  method = 'GET',
  expires = 300,
  headers: Record<string, string> = {},
  now = new Date(),
) {
  const url = new URL(config.endpoint)
  url.pathname = `${url.pathname.replace(/\/$/, '')}/${encode(config.bucket)}/${key.split('/').map(encode).join('/')}`
  return signS3ObjectUrl(config, url, method, expires, headers, now)
}
export function signS3ObjectUrl(
  config: S3Config,
  target: URL,
  method: string,
  expires: number,
  headers: Record<string, string> = {},
  now = new Date(),
) {
  if (!Number.isInteger(expires) || expires < 1 || expires > 604800)
    throw new Error('Invalid media URL expiry.')
  const url = new URL(target)
  const timestamp = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const date = timestamp.slice(0, 8)
  const scope = `${date}/${config.region}/s3/aws4_request`
  const values: Record<string, string> = { host: url.host }
  for (const [name, value] of Object.entries(headers))
    values[name.toLowerCase()] = value.trim().replace(/\s+/g, ' ')
  const names = Object.keys(values).sort()
  url.searchParams.set('X-Amz-Algorithm', 'AWS4-HMAC-SHA256')
  url.searchParams.set('X-Amz-Credential', `${config.accessKey}/${scope}`)
  url.searchParams.set('X-Amz-Date', timestamp)
  url.searchParams.set('X-Amz-Expires', String(expires))
  url.searchParams.set('X-Amz-SignedHeaders', names.join(';'))
  const query = [...url.searchParams]
    .map(([k, v]) => [encode(k), encode(v)] as const)
    .sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : a[1] < b[1] ? -1 : 1))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  const canonical = [
    method,
    url.pathname,
    query,
    names.map((name) => `${name}:${values[name]}\n`).join(''),
    names.join(';'),
    'UNSIGNED-PAYLOAD',
  ].join('\n')
  const signingKey = hmac(
    hmac(hmac(hmac(`AWS4${config.secretKey}`, date), config.region), 's3'),
    'aws4_request',
  )
  const signature = createHmac('sha256', signingKey)
    .update(`AWS4-HMAC-SHA256\n${timestamp}\n${scope}\n${hash(canonical)}`)
    .digest('hex')
  url.search = `${query}&X-Amz-Signature=${signature}`
  return url.href
}
function localPath(key: string) {
  assertKey(key)
  return path.join(process.cwd(), 'data', 'uploads', key)
}
async function request(
  key: string,
  method: string,
  headers: Record<string, string> = {},
  body?: Uint8Array,
) {
  assertKey(key)
  const response = await fetch(signS3Url(s3Config(), key, method, 300, headers), {
    method,
    headers,
    body: body ? new Uint8Array(body) : undefined,
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok && response.status !== 404) throw new Error('Media storage request failed.')
  return response
}
export async function putObject(
  key: string,
  data: Uint8Array,
  contentType = 'application/octet-stream',
) {
  assertKey(key)
  if (process.env.STORAGE_DRIVER === 's3') {
    await request(key, 'PUT', { 'content-type': contentType }, data)
    return
  }
  localAllowed()
  const file = localPath(key)
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, data)
}
export async function getObject(key: string, maxBytes = 60 * 1024 * 1024): Promise<Buffer | null> {
  assertKey(key)
  if (process.env.STORAGE_DRIVER === 's3') {
    const res = await request(key, 'GET')
    if (res.status === 404) return null
    const chunks: Uint8Array[] = []
    let size = 0
    if (!res.body) throw new Error('Empty media response.')
    const reader = res.body.getReader()
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        size += chunk.value.byteLength
        if (size > maxBytes) {
          await reader.cancel()
          throw new Error('Media exceeds its size limit.')
        }
        chunks.push(chunk.value)
      }
    } finally {
      reader.releaseLock()
    }
    return Buffer.concat(chunks)
  }
  localAllowed()
  try {
    const info = await stat(localPath(key))
    if (info.size > maxBytes) throw new Error('Media exceeds its size limit.')
    return await readFile(localPath(key))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}
export async function objectHeader(key: string) {
  assertKey(key)
  if (process.env.STORAGE_DRIVER === 's3') {
    const head = await request(key, 'HEAD')
    if (head.status === 404) return null
    const size = Number(head.headers.get('content-length'))
    const etag = head.headers.get('etag')
    if (!Number.isSafeInteger(size) || size <= 0 || !etag)
      throw new Error('Invalid media metadata.')
    const res = await request(key, 'GET', { range: 'bytes=0-65535', 'if-match': etag })
    if (res.status !== 206 || !res.body) {
      await res.body?.cancel()
      throw new Error('Storage must support ranged media validation.')
    }
    const data = Buffer.from(await res.arrayBuffer())
    if (data.length > 65536) throw new Error('Invalid media range.')
    return { size, etag, data }
  }
  localAllowed()
  try {
    const data = await readFile(localPath(key))
    return {
      size: data.length,
      etag: createHash('sha256').update(data).digest('hex'),
      data: data.subarray(0, 65536),
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null
    throw err
  }
}
/** Browser upload capability only addresses staging. Copy to a new key makes accepted bytes immutable. */
export async function promoteObject(source: string, destination: string, etag: string) {
  assertKey(source)
  assertKey(destination)
  if (process.env.STORAGE_DRIVER === 's3') {
    const config = s3Config()
    const response = await request(destination, 'PUT', {
      'x-amz-copy-source': `/${config.bucket}/${source.split('/').map(encode).join('/')}`,
      'x-amz-copy-source-if-match': etag,
    })
    const xml = await response.text()
    if (xml.includes('<Error>') || !xml.includes('<CopyObjectResult'))
      throw new Error('Could not finalize media copy.')
  } else {
    localAllowed()
    const data = await getObject(source)
    if (!data || createHash('sha256').update(data).digest('hex') !== etag)
      throw new Error('Media changed during validation.')
    await putObject(destination, data)
  }
}
export async function deleteObject(key: string) {
  assertKey(key)
  if (process.env.STORAGE_DRIVER === 's3') {
    await request(key, 'DELETE')
    return
  }
  localAllowed()
  try {
    await unlink(localPath(key))
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err
  }
}
export function privateObjectUrl(key: string, expires = 300) {
  assertKey(key)
  return signS3Url(s3Config(), key, 'GET', expires)
}
export function directUploadUrl(key: string, contentType: string, sizeBytes: number) {
  assertKey(key)
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1) throw new Error('Invalid upload size.')
  return {
    url: signS3Url(s3Config(), key, 'PUT', 300, {
      'content-type': contentType,
      'content-length': String(sizeBytes),
    }),
    headers: { 'Content-Type': contentType },
  }
}
