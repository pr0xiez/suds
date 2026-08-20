/**
 * Image type sniffing and intrinsic dimensions read straight from file headers.
 *
 * Deliberately dependency-free: `sharp` needs a native build and this
 * environment has no compiler (see AGENTS.md). Unrecognised formats are
 * rejected at upload; dimension parse failures degrade to null.
 */

export interface Dimensions {
  width: number
  height: number
}

export interface SniffedImage {
  ext: 'jpg' | 'png' | 'webp' | 'gif'
  contentType: string
}

/** Magic-byte detection — the only formats the app accepts. */
export function sniffImageType(buf: Buffer): SniffedImage | null {
  if (buf.length < 12) return null
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' }
  }
  if (buf.readUInt32BE(0) === 0x89504e47) {
    return { ext: 'png', contentType: 'image/png' }
  }
  if (buf.toString('ascii', 0, 4) === 'GIF8') {
    return { ext: 'gif', contentType: 'image/gif' }
  }
  if (buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', contentType: 'image/webp' }
  }
  return null
}

function readPng(buf: Buffer): Dimensions | null {
  // \x89PNG\r\n\x1a\n then IHDR at byte 16
  if (buf.length < 24) return null
  if (buf.readUInt32BE(0) !== 0x89504e47) return null
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

function readGif(buf: Buffer): Dimensions | null {
  if (buf.length < 10) return null
  if (buf.toString('ascii', 0, 3) !== 'GIF') return null
  return { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) }
}

function readJpeg(buf: Buffer): Dimensions | null {
  if (buf.length < 4) return null
  if (buf.readUInt16BE(0) !== 0xffd8) return null

  let offset = 2
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = buf[offset + 1]
    if (marker === undefined) return null

    // Standalone markers carry no length field.
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2
      continue
    }
    const length = buf.readUInt16BE(offset + 2)

    // SOF0..SOF15, excluding DHT (c4), JPGA (c8) and DAC (cc)
    const isStartOfFrame =
      marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
    if (isStartOfFrame) {
      return { height: buf.readUInt16BE(offset + 5), width: buf.readUInt16BE(offset + 7) }
    }
    if (length <= 0) return null
    offset += 2 + length
  }
  return null
}

function readWebp(buf: Buffer): Dimensions | null {
  if (buf.length < 30) return null
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WEBP') return null

  const format = buf.toString('ascii', 12, 16)
  if (format === 'VP8 ') {
    return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff }
  }
  if (format === 'VP8L') {
    const bits = buf.readUInt32LE(21)
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }
  }
  if (format === 'VP8X') {
    const width = 1 + (buf.readUInt32LE(24) & 0x00ffffff)
    const height = 1 + (buf.readUInt32LE(27) & 0x00ffffff)
    return { width, height }
  }
  return null
}

export function readImageDimensions(buf: Buffer): Dimensions | null {
  const result = readPng(buf) ?? readGif(buf) ?? readWebp(buf) ?? readJpeg(buf)
  if (!result) return null
  if (!Number.isFinite(result.width) || !Number.isFinite(result.height)) return null
  if (result.width <= 0 || result.height <= 0) return null
  return result
}
