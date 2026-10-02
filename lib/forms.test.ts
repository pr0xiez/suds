import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { friendlyError } from '@/lib/forms'

const schema = z.object({
  phone: z.string().min(5, 'Enter a contact phone number'),
  waterPowerNotes: z.string().max(3),
  make: z.string().min(1),
  year: z.number().max(2100),
})

describe('friendlyError', () => {
  it('reports every schema problem, naming fields for generic messages', () => {
    const result = schema.safeParse({ phone: '1', waterPowerNotes: 'long', make: '', year: 3000 })
    expect(result.success).toBe(false)
    expect(friendlyError(result.error)).toBe(
      'Enter a contact phone number. Water power notes can be at most 3 characters. Make is required. Year must be 2100 or less.',
    )
  })

  it('hides infrastructure errors', () => {
    expect(friendlyError(Object.assign(new Error('P2002 unique'), { code: 'P2002' }))).toBe(
      'Something went wrong. Try again.',
    )
  })
})
