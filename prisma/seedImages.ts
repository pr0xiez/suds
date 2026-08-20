import { encodePng } from '@/lib/png'

/**
 * Deterministic placeholder "job photos" for the seed: muddy browns for the
 * befores, a glossy blue with light streaks for the afters. No randomness so a
 * re-seed produces byte-identical files.
 */

function noise(x: number, y: number, seed: number): number {
  // Cheap deterministic hash noise in [0, 1)
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 37.719) * 43758.5453
  return n - Math.floor(n)
}

/** A grimy panel: brown gradient, blotches of caked dirt. */
export function beforeImage(seed: number, width = 640, height = 480): Buffer {
  return encodePng(width, height, (x, y) => {
    const t = y / height
    let r = 96 + t * 40
    let g = 78 + t * 30
    let b = 58 + t * 22
    const blotch = noise(Math.floor(x / 24), Math.floor(y / 24), seed)
    if (blotch > 0.62) {
      const depth = (blotch - 0.62) * 140
      r -= depth
      g -= depth
      b -= depth
    }
    const grain = (noise(x, y, seed + 1) - 0.5) * 18
    return [r + grain, g + grain, b + grain]
  })
}

/** The same panel after: deep gloss blue with diagonal gleam streaks. */
export function afterImage(seed: number, width = 640, height = 480): Buffer {
  return encodePng(width, height, (x, y) => {
    const t = y / height
    let r = 12 + t * 30
    let g = 52 + t * 70
    let b = 96 + t * 110
    const diag = (x + y * 2 + seed * 53) % 340
    if (diag < 26) {
      const shine = (1 - diag / 26) * 130
      r += shine
      g += shine
      b += shine
    }
    return [r, g, b]
  })
}
