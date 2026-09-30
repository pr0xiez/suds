import { afterEach, expect, it, vi } from 'vitest'
import { buildPhotoTimeline, createPhotoShort, getPhotoShort } from './photoShorts'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})
it('keeps selected photos in order in a vertical MP4 with bounded duration', () => {
  const timeline = buildPhotoTimeline([
    'https://example.com/before.jpg',
    'https://example.com/after.jpg',
  ])
  expect(timeline.output.aspectRatio).toBe('9:16')
  expect(timeline.output.format).toBe('mp4')
  expect(
    timeline.timeline.tracks[0]?.clips.map((clip) => [clip.asset.src, clip.start, clip.length]),
  ).toEqual([
    ['https://example.com/before.jpg', 0, 4],
    ['https://example.com/after.jpg', 4, 4],
  ])
})
it('requires connected durable storage before charging a photo render', async () => {
  vi.stubEnv('SHOTSTACK_API_KEY', 'fake-key')
  vi.stubEnv('STORAGE_DRIVER', 'local')
  const request = vi.fn()
  vi.stubGlobal('fetch', request)
  await expect(
    createPhotoShort('Before and after', [
      'https://example.com/a.jpg',
      'https://example.com/b.jpg',
    ]),
  ).rejects.toThrow('not connected')
  expect(request).not.toHaveBeenCalled()
})
it('returns the temporary completed output for immediate private archival', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          response: {
            id: '550e8400-e29b-41d4-a716-446655440000',
            status: 'done',
            url: 'https://cdn.shotstack.io/render.mp4',
          },
        }),
      ),
    ),
  )
  expect((await getPhotoShort('550e8400-e29b-41d4-a716-446655440000')).downloadUrl).toBe(
    'https://cdn.shotstack.io/render.mp4',
  )
})
