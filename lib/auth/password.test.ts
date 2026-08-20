import { describe, expect, it } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/auth/password'

describe('scrypt passwords', () => {
  it('hashes and verifies a round trip', async () => {
    const hash = await hashPassword('correct horse battery')
    expect(hash.startsWith('scrypt$')).toBe(true)
    expect(await verifyPassword('correct horse battery', hash)).toBe(true)
  })

  it('rejects the wrong password', async () => {
    const hash = await hashPassword('correct horse battery')
    expect(await verifyPassword('wrong horse', hash)).toBe(false)
  })

  it('salts every hash', async () => {
    expect(await hashPassword('same password')).not.toBe(await hashPassword('same password'))
  })

  it('rejects malformed stored values without throwing', async () => {
    expect(await verifyPassword('anything', '')).toBe(false)
    expect(await verifyPassword('anything', 'bcrypt$whatever')).toBe(false)
    expect(await verifyPassword('anything', 'scrypt$not$enough')).toBe(false)
  })

  it('refuses short passwords at hash time', async () => {
    await expect(hashPassword('short')).rejects.toThrow()
  })
})
