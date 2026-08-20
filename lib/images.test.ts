import { describe, expect, it } from 'vitest'
import { readImageDimensions, sniffImageType } from '@/lib/images'
import { encodePng } from '@/lib/png'

describe('png (encoder → sniffer → dimensions round-trip)', () => {
  it('sniffs and measures a generated PNG', () => {
    const png = encodePng(320, 240, (x, y) => [x % 256, y % 256, 0])
    expect(sniffImageType(png)).toEqual({ ext: 'png', contentType: 'image/png' })
    expect(readImageDimensions(png)).toEqual({ width: 320, height: 240 })
  })

  it('rejects degenerate dimensions', () => {
    expect(() => encodePng(0, 10, () => [0, 0, 0])).toThrow()
  })
})

describe('jpeg', () => {
  it('reads dimensions from a SOF0 frame', () => {
    // SOI, then SOF0 with height 240, width 320.
    const jpeg = Buffer.from([
      0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08, 0x00, 0xf0, 0x01, 0x40, 0x03, 0x01, 0x22, 0x00,
      0x02, 0x11, 0x01, 0x03, 0x11, 0x01, 0xff, 0xd9,
    ])
    expect(sniffImageType(jpeg)?.ext).toBe('jpg')
    expect(readImageDimensions(jpeg)).toEqual({ width: 320, height: 240 })
  })
})

describe('gif', () => {
  it('reads the logical screen size', () => {
    const gif = Buffer.concat([
      Buffer.from('GIF89a', 'ascii'),
      Buffer.from([0x40, 0x01, 0xf0, 0x00, 0x00, 0x00, 0x00, 0x00]), // 320 × 240 LE
    ])
    expect(sniffImageType(gif)?.ext).toBe('gif')
    expect(readImageDimensions(gif)).toEqual({ width: 320, height: 240 })
  })
})

describe('webp', () => {
  it('reads VP8L dimensions', () => {
    const buf = Buffer.alloc(32)
    buf.write('RIFF', 0, 'ascii')
    buf.writeUInt32LE(24, 4)
    buf.write('WEBP', 8, 'ascii')
    buf.write('VP8L', 12, 'ascii')
    buf.writeUInt32LE(10, 16)
    buf[20] = 0x2f
    // width-1 = 99 (14 bits), height-1 = 49 (next 14 bits)
    buf.writeUInt32LE((99 & 0x3fff) | ((49 & 0x3fff) << 14), 21)
    expect(sniffImageType(buf)?.ext).toBe('webp')
    expect(readImageDimensions(buf)).toEqual({ width: 100, height: 50 })
  })
})

describe('junk', () => {
  it('is rejected by both sniffer and parser', () => {
    const junk = Buffer.from('definitely not an image, not even close')
    expect(sniffImageType(junk)).toBeNull()
    expect(readImageDimensions(junk)).toBeNull()
    expect(sniffImageType(Buffer.alloc(3))).toBeNull()
  })
})
