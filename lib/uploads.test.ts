import { describe, expect, it } from 'vitest'
import { isSafeUploadFilename } from '@/lib/uploads'

describe('isSafeUploadFilename', () => {
  it('accepts the names the app generates', () => {
    expect(isSafeUploadFilename('a1b2c3d4e5f6a1b2c3d4e5f6.jpg')).toBe(true)
    expect(isSafeUploadFilename('deadbeef00.png')).toBe(true)
    expect(isSafeUploadFilename('cafe1234.webp')).toBe(true)
    expect(isSafeUploadFilename('feed42.gif')).toBe(true)
  })

  it('rejects traversal and oddball names', () => {
    expect(isSafeUploadFilename('../etc/passwd')).toBe(false)
    expect(isSafeUploadFilename('..%2f..%2fsecret.png')).toBe(false)
    expect(isSafeUploadFilename('photo.png.exe')).toBe(false)
    expect(isSafeUploadFilename('a/b.png')).toBe(false)
    expect(isSafeUploadFilename('UPPER.png')).toBe(false)
    expect(isSafeUploadFilename('name with space.jpg')).toBe(false)
    expect(isSafeUploadFilename('photo.svg')).toBe(false)
    expect(isSafeUploadFilename('')).toBe(false)
  })
})
