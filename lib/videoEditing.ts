import { createHmac, timingSafeEqual } from 'node:crypto'
import { z } from 'zod'

export const MAX_VIDEO_BYTES = 50 * 1024 * 1024
export const VIDEO_STYLES = ['kelly', 'karl', 'ella'] as const
const optionsSchema = z.object({
  title: z.string().trim().min(1).max(100),
  style: z.enum(VIDEO_STYLES),
  approved: z.literal('true'),
})
const httpsUrl = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === 'https:')
const projectSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  status: z.enum(['processing', 'transcribing', 'exporting', 'completed', 'failed']),
  directUrl: httpsUrl.nullish(),
  downloadUrl: httpsUrl.nullish(),
  previewUrl: httpsUrl.nullish(),
})
export type VideoProject = z.infer<typeof projectSchema>

export function videoEditingConfigured() {
  return Boolean(process.env.SUBMAGIC_API_KEY?.trim())
}
function apiKey() {
  const key = process.env.SUBMAGIC_API_KEY?.trim()
  if (!key) throw new Error('AI video editing is not connected yet.')
  return key
}
export async function validateVideoBrief(form: FormData) {
  const result = optionsSchema.safeParse(Object.fromEntries(form))
  if (!result.success)
    throw new Error('Add a title, choose a style, and approve the video for editing.')
  const file = form.get('file')
  if (!(file instanceof File) || file.size === 0 || file.size > MAX_VIDEO_BYTES) {
    throw new Error('Choose an MP4 or MOV video smaller than 50 MB.')
  }
  // ISO base media container signature; the provider validates video tracks/codecs.
  const header = Buffer.from(await file.slice(0, 16).arrayBuffer())
  if (header.length < 12 || header.toString('ascii', 4, 8) !== 'ftyp') {
    throw new Error('Choose an MP4 or MOV video.')
  }
  return { ...result.data, file }
}
async function providerRequest(path: string, body?: FormData): Promise<VideoProject> {
  let response: Response
  try {
    response = await fetch(`https://api.submagic.co/v1/projects${path}`, {
      method: body ? 'POST' : 'GET',
      headers: { 'x-api-key': apiKey() },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(body ? 120_000 : 20_000),
    })
  } catch {
    throw new Error(
      body
        ? 'The upload could not be confirmed. Do not resubmit yet; check the editing provider for a project.'
        : 'Could not check the edit. Try checking its status again.',
    )
  }
  if (!response.ok) {
    throw new Error(
      response.status === 429
        ? 'The editor is busy. Wait a minute and check again.'
        : 'The editing provider could not process this request. Check the connection and available credits.',
    )
  }
  const data = projectSchema.safeParse(await response.json().catch(() => null))
  if (!data.success)
    throw new Error(
      'The editor returned an unexpected response. Check the provider before resubmitting.',
    )
  return data.data
}
export async function uploadVideoEdit(form: FormData) {
  const brief = await validateVideoBrief(form)
  const payload = new FormData()
  payload.set('title', brief.title)
  payload.set('language', 'en')
  payload.set('file', brief.file, 'source.mp4')
  // AI edit templates cannot be combined with other editing options.
  payload.set('aiEditTemplate', brief.style)
  return providerRequest('/upload', payload)
}
export function getVideoEdit(id: string) {
  return providerRequest(`/${z.string().uuid().parse(id)}`)
}
const tokenSchema = z.object({ id: z.string().uuid(), userId: z.string(), expires: z.number() })
export function signVideoProject(id: string, userId: string, key = apiKey(), now = Date.now()) {
  const payload = Buffer.from(
    JSON.stringify({ id, userId, expires: now + 30 * 86400_000 }),
  ).toString('base64url')
  const signature = createHmac('sha256', key).update(`suds-video:${payload}`).digest('base64url')
  return `${payload}.${signature}`
}
export function verifyVideoProject(
  token: string,
  userId: string,
  key = apiKey(),
  now = Date.now(),
) {
  try {
    const parts = token.split('.')
    if (parts.length !== 2 || !parts[0] || !parts[1]) return null
    const signature = Buffer.from(parts[1], 'base64url')
    const expected = createHmac('sha256', key).update(`suds-video:${parts[0]}`).digest()
    if (signature.length !== expected.length || !timingSafeEqual(signature, expected)) return null
    const data = tokenSchema.safeParse(JSON.parse(Buffer.from(parts[0], 'base64url').toString()))
    if (!data.success || data.data.userId !== userId || data.data.expires <= now) return null
    return data.data.id
  } catch {
    return null
  }
}

/** Submit only an app-authorized immutable object URL; never a URL from a browser. */
export async function createVideoEdit(input: {
  title: string
  style: (typeof VIDEO_STYLES)[number]
  videoUrl: string
}) {
  const title = z.string().trim().min(1).max(100).parse(input.title)
  const style = z.enum(VIDEO_STYLES).parse(input.style)
  const videoUrl = httpsUrl.parse(input.videoUrl)
  let response: Response
  try {
    response = await fetch('https://api.submagic.co/v1/projects', {
      method: 'POST',
      headers: { 'x-api-key': apiKey(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, language: 'en', videoUrl, aiEditTemplate: style }),
      signal: AbortSignal.timeout(25_000),
      cache: 'no-store',
    })
  } catch {
    throw new Error(
      'The editing submission could not be confirmed. An administrator must reconcile it before retrying.',
    )
  }
  if (!response.ok)
    throw new Error(
      'The editing submission was rejected or could not be confirmed. An administrator must check provider usage before retrying.',
    )
  const data = projectSchema.safeParse(await response.json().catch(() => null))
  if (!data.success)
    throw new Error(
      'The editor returned an unexpected submission response. An administrator must reconcile it.',
    )
  return data.data
}
