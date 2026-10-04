import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { friendlyError, safeBackPath, userFacingError } from '@/lib/forms'

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

describe('error and redirect boundaries', () => {
  it('passes deliberate messages and hides runtime error classes', () => {
    expect(friendlyError(new Error('Choose a completed job.'))).toBe('Choose a completed job.')
    expect(friendlyError(new SyntaxError('Unexpected token in JSON: secret draft'))).toBe(
      'Something went wrong. Try again.',
    )
    expect(userFacingError(new TypeError('fetch failed'), 'Could not queue the draft.')).toBe(
      'Could not queue the draft.',
    )
    expect(userFacingError(new Error('Draft not found.'), 'Could not save.')).toBe(
      'Draft not found.',
    )
  })

  it('keeps hidden back paths on this site', () => {
    expect(safeBackPath('/jobs/abc?tab=photos', '/jobs')).toBe('/jobs/abc?tab=photos')
    for (const raw of [
      '//evil.example',
      '/\\evil.example',
      '/\t/evil.example',
      'https://evil.example',
      '',
    ])
      expect(safeBackPath(raw, '/jobs')).toBe('/jobs')
  })
})
