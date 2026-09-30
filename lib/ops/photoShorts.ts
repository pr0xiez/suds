import { z } from 'zod'
import { durableStorageConfigured } from '@/lib/storage'
import type { VideoProject } from '@/lib/videoEditing'
export function photoShortsConfigured() {
  return Boolean(process.env.SHOTSTACK_API_KEY?.trim() && durableStorageConfigured())
}
export function buildPhotoTimeline(urls: string[]) {
  return {
    timeline: {
      background: '#142b2c',
      tracks: [
        {
          clips: urls.map((src, i) => ({
            asset: { type: 'image', src },
            start: i * 4,
            length: 4,
            fit: 'contain',
            effect: 'zoomInSlow',
            transition: { in: 'fade', out: 'fade' },
          })),
        },
      ],
    },
    output: { format: 'mp4', resolution: '1080', aspectRatio: '9:16', fps: 30 },
  }
}
async function shotstack(path: string, body?: object) {
  const environment = process.env.SHOTSTACK_ENV === 'v1' ? 'v1' : 'stage'
  const response = await fetch(`https://api.shotstack.io/edit/${environment}/render${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      'x-api-key': process.env.SHOTSTACK_API_KEY ?? '',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(25_000),
    cache: 'no-store',
  })
  if (!response.ok)
    throw new Error(
      body
        ? 'The photo render submission could not be confirmed. An administrator must check provider usage before retrying.'
        : 'Could not check the photo render.',
    )
  return response.json()
}
/** URLs originate only from scoped approved photo rows, never the browser brief. */
export async function createPhotoShort(title: string, urls: string[]): Promise<VideoProject> {
  if (!photoShortsConfigured()) throw new Error('Photo video generation is not connected yet.')
  z.string().trim().min(1).max(100).parse(title)
  z.array(
    z
      .string()
      .url()
      .refine((url) => new URL(url).protocol === 'https:'),
  )
    .min(2)
    .max(8)
    .parse(urls)
  const data = await shotstack('', buildPhotoTimeline(urls))
  return { id: z.string().uuid().parse(data?.response?.id), title, status: 'processing' }
}
export async function getPhotoShort(id: string): Promise<VideoProject> {
  const data = await shotstack(`/${z.string().uuid().parse(id)}`)
  const response = z
    .object({
      id: z.string().uuid(),
      status: z.string(),
      url: z
        .string()
        .url()
        .refine((url) => new URL(url).protocol === 'https:')
        .optional(),
    })
    .parse(data.response)
  return {
    id: response.id,
    title: 'Your photo short',
    status:
      response.status === 'failed'
        ? 'failed'
        : response.status === 'done'
          ? 'completed'
          : 'exporting',
    directUrl: response.status === 'done' ? response.url : undefined,
    downloadUrl: response.status === 'done' ? response.url : undefined,
  }
}
