import { describe, expect, it } from 'vitest'
import { allowAttempt, resetAttempts } from '@/lib/auth/rateLimit'

describe('allowAttempt', () => {
  it('allows up to the cap, then blocks', () => {
    const key = 'test:cap'
    for (let i = 0; i < 5; i++) {
      expect(allowAttempt(key, 5, 1000, 0)).toBe(true)
    }
    expect(allowAttempt(key, 5, 1000, 0)).toBe(false)
    resetAttempts(key)
  })

  it('opens again after the window passes', () => {
    const key = 'test:window'
    for (let i = 0; i < 3; i++) allowAttempt(key, 3, 1000, 0)
    expect(allowAttempt(key, 3, 1000, 500)).toBe(false)
    expect(allowAttempt(key, 3, 1000, 1500)).toBe(true)
    resetAttempts(key)
  })

  it('resetAttempts clears a key', () => {
    const key = 'test:reset'
    for (let i = 0; i < 4; i++) allowAttempt(key, 3, 1000, 0)
    resetAttempts(key)
    expect(allowAttempt(key, 3, 1000, 0)).toBe(true)
    resetAttempts(key)
  })
})
