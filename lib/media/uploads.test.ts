import { expect, it, vi } from 'vitest'

vi.mock('@/lib/db/client', () => ({ prisma: {} }))

import { encodePng } from '@/lib/png'
import { validateMediaHeader } from './uploads'

it('validates immutable uploaded bytes against authorized size and magic type', () => {
  const png = encodePng(2, 2, () => [255, 255, 255])
  expect(validateMediaHeader('PHOTO', 'image/png', png.length, png.length, png).ext).toBe('png')
  expect(() => validateMediaHeader('PHOTO', 'image/jpeg', png.length, png.length, png)).toThrow(
    'valid JPEG',
  )
  expect(() => validateMediaHeader('PHOTO', 'image/png', png.length + 1, png.length, png)).toThrow(
    'size',
  )
  expect(() =>
    validateMediaHeader('VIDEO', 'video/mp4', 15, 15, Buffer.from('renamed nonvideo')),
  ).toThrow('MP4')
})
