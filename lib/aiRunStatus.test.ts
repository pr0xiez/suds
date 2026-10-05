import { describe, expect, it } from 'vitest'
import { IN_FLIGHT_STATUSES, isInFlight, MAX_RUN_PHOTOS } from '@/lib/aiRunStatus'

describe('aiRunStatus', () => {
  it('treats queued, submitting, and processing as in flight', () => {
    for (const status of IN_FLIGHT_STATUSES) expect(isInFlight(status)).toBe(true)
    for (const status of ['COMPLETED', 'FAILED', 'UNCERTAIN', '']) {
      expect(isInFlight(status)).toBe(false)
    }
  })
  it('caps photos at eight', () => expect(MAX_RUN_PHOTOS).toBe(8))
})
