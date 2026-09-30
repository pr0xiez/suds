import { describe, expect, it } from 'vitest'
import {
  assertPublicSlot,
  availableSlots,
  type BookingRules,
  bookingTimeLabel,
  overlaps,
  parseBookingInstant,
  parseWorkingHours,
  reservationInterval,
} from '@/lib/bookingAvailability'

const rules: BookingRules = {
  timezone: 'America/New_York',
  workingHours: [
    { day: 0, start: '09:00', end: '12:00' },
    { day: 0, start: '13:00', end: '17:00' },
  ],
  travelBufferMin: 30,
  leadTimeMin: 120,
  horizonDays: 60,
}
const now = new Date('2026-09-27T12:00:00Z')

describe('mobile detailer availability', () => {
  it('accepts only valid explicit UTC instants from browser forms', () => {
    expect(parseBookingInstant('2026-09-28T13:00:00.000Z')?.toISOString()).toBe(
      '2026-09-28T13:00:00.000Z',
    )
    expect(parseBookingInstant('2026-09-28T13:00')).toBeNull()
    expect(parseBookingInstant('2026-02-31T13:00:00.000Z')).toBeNull()
    expect(parseBookingInstant(new Date('invalid'))).toBeNull()
  })
  it('fits the entire service and travel buffer inside one working window', () => {
    const slots = availableSlots(rules, '2026-09-28', 60, [], now).map((slot) => slot.toISOString())
    expect(slots).toContain('2026-09-28T13:00:00.000Z')
    expect(slots).toContain('2026-09-28T14:30:00.000Z')
    expect(slots).not.toContain('2026-09-28T14:45:00.000Z')
    expect(slots).not.toContain('2026-09-28T16:00:00.000Z')
    expect(slots.at(-1)).toBe('2026-09-28T19:30:00.000Z')
  })

  it('removes overlap including travel but permits touching half-open boundaries', () => {
    const busy = [reservationInterval(new Date('2026-09-28T13:00:00Z'), 60, 30)]
    const slots = availableSlots(rules, '2026-09-28', 60, busy, now).map((slot) =>
      slot.toISOString(),
    )
    expect(slots).not.toContain('2026-09-28T14:15:00.000Z')
    expect(slots).toContain('2026-09-28T14:30:00.000Z')
    expect(
      overlaps(reservationInterval(new Date('2026-09-28T13:00:00Z'), 60, 30), {
        start: new Date('2026-09-28T14:30:00Z'),
        end: new Date('2026-09-28T15:00:00Z'),
      }),
    ).toBe(false)
  })

  it('respects lead time, horizon, closed weekdays and impossible dates', () => {
    expect(
      availableSlots(
        rules,
        '2026-09-28',
        60,
        [],
        new Date('2026-09-28T13:00:00Z'),
      )[0]?.toISOString(),
    ).toBe('2026-09-28T17:00:00.000Z')
    expect(availableSlots(rules, '2026-09-29', 60, [], now)).toEqual([])
    expect(availableSlots(rules, '2027-01-04', 60, [], now)).toEqual([])
    expect(availableSlots(rules, '2026-02-31', 60, [], now)).toEqual([])
    expect(() => assertPublicSlot(rules, new Date('2026-09-28T13:07:00Z'), 60, now)).toThrow(
      'outside booking hours',
    )
  })

  it('does not invent nonexistent spring-forward times', () => {
    const dst = {
      ...rules,
      workingHours: [{ day: 6, start: '01:00', end: '05:00' }],
      travelBufferMin: 0,
      leadTimeMin: 0,
    }
    const slots = availableSlots(dst, '2027-03-14', 30, [], new Date('2027-03-13T00:00:00Z'))
    const times = slots.map((slot) =>
      new Intl.DateTimeFormat('en-US', {
        timeZone: dst.timezone,
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23',
      }).format(slot),
    )
    expect(times).not.toContain('02:00')
    expect(times).toContain('01:30')
    expect(times).toContain('03:00')
    expect(times.at(-1)).toBe('04:30')
  })

  it('keeps both repeated fall-back instants with distinct UTC identities', () => {
    const dst = {
      ...rules,
      workingHours: [{ day: 6, start: '00:00', end: '04:00' }],
      travelBufferMin: 0,
      leadTimeMin: 0,
    }
    const slots = availableSlots(dst, '2026-11-01', 30, [], new Date('2026-10-31T00:00:00Z')).map(
      (slot) => slot.toISOString(),
    )
    expect(slots).toContain('2026-11-01T05:00:00.000Z')
    expect(slots).toContain('2026-11-01T06:00:00.000Z')
    expect(new Set(slots).size).toBe(slots.length)
    expect(bookingTimeLabel(new Date('2026-11-01T05:00:00Z'), dst.timezone)).not.toBe(
      bookingTimeLabel(new Date('2026-11-01T06:00:00Z'), dst.timezone),
    )
  })

  it('anchors dates to the business timezone rather than the server date', () => {
    const west = {
      ...rules,
      timezone: 'America/Los_Angeles',
      workingHours: [{ day: 6, start: '18:00', end: '23:00' }],
      leadTimeMin: 0,
    }
    const slots = availableSlots(west, '2026-09-27', 60, [], new Date('2026-09-28T01:00:00Z'))
    expect(slots[0]?.toISOString()).toBe('2026-09-28T01:00:00.000Z')
  })

  it('supports non-quarter-hour opening times without eliminating the day', () => {
    const slots = availableSlots(
      { ...rules, workingHours: [{ day: 0, start: '09:10', end: '12:00' }] },
      '2026-09-28',
      60,
      [],
      now,
    )
    expect(slots[0]?.toISOString()).toBe('2026-09-28T13:15:00.000Z')
  })

  it('rejects malformed, overlapping and overnight hour windows', () => {
    expect(() => parseWorkingHours([{ day: 0, start: '12:00', end: '11:00' }])).toThrow()
    expect(() =>
      parseWorkingHours([
        { day: 0, start: '09:00', end: '14:00' },
        { day: 0, start: '13:00', end: '17:00' },
      ]),
    ).toThrow('overlap')
    expect(() => parseWorkingHours([{ day: 7, start: '09:00', end: '17:00' }])).toThrow()
    expect(() => reservationInterval(new Date('2026-09-28T13:00:00Z'), 14, 30)).toThrow()
  })
})
