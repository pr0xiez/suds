import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>

/**
 * Password hashing on Node's built-in scrypt.
 *
 * No bcrypt/argon2 dependency on purpose: those need node-gyp, and this
 * environment has no compiler (see AGENTS.md). scrypt is memory-hard, in the
 * standard library, and needs no native build.
 */

const KEYLEN = 64
const SALT_BYTES = 16

// ~16 MiB of memory per hash: enough to be expensive to attack in bulk, cheap
// enough that a login stays well under a second.
const PARAMS = { N: 16384, r: 8, p: 1 }
const MAXMEM = 64 * 1024 * 1024

export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < 8) {
    throw new Error('Password must be at least 8 characters')
  }
  const salt = randomBytes(SALT_BYTES)
  const derived = await scrypt(plain.normalize('NFKC'), salt, KEYLEN, { ...PARAMS, maxmem: MAXMEM })
  return [
    'scrypt',
    PARAMS.N,
    PARAMS.r,
    PARAMS.p,
    salt.toString('base64'),
    derived.toString('base64'),
  ].join('$')
}

export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  if (!plain || !stored) return false

  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [, nRaw, rRaw, pRaw, saltB64, hashB64] = parts
  const N = Number(nRaw)
  const r = Number(rRaw)
  const p = Number(pRaw)
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false
  if (!saltB64 || !hashB64) return false

  const salt = Buffer.from(saltB64, 'base64')
  const expected = Buffer.from(hashB64, 'base64')
  if (expected.length === 0) return false

  let derived: Buffer
  try {
    derived = await scrypt(plain.normalize('NFKC'), salt, expected.length, {
      N,
      r,
      p,
      maxmem: MAXMEM,
    })
  } catch {
    return false
  }

  // Length is already equal by construction, but timingSafeEqual throws on a
  // mismatch rather than returning false, so guard it.
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}
