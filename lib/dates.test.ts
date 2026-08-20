import { describe, expect, it } from 'vitest'
import {
  addDays,
  dateKey,
  dayBoundsUtc,
  getWallTime,
  minutesIntoDay,
  minutesToHuman,
  monthGrid,
  parseDateKey,
  parseDatetimeLocal,
  startOfWeek,
  toDatetimeLocalValue,
  wallTimeToUtc,
  weekdayIndex,
} from '@/lib/dates'

const NY = 'America/New_York'

describe('wall time ↔ UTC', () => {
  it('converts an EDT wall time (UTC-4)', () => {
    const date = parseDatetimeLocal('2026-08-19T14:30', NY)
    expect(date?.toISOString()).toBe('2026-08-19T18:30:00.000Z')
  })

  it('converts an EST wall time (UTC-5)', () => {
    const date = parseDatetimeLocal('2026-01-15T14:30', NY)
    expect(date?.toISOString()).toBe('2026-01-15T19:30:00.000Z')
  })

  it('round-trips through the datetime-local format', () => {
    const date = parseDatetimeLocal('2026-08-19T09:15', NY)
    expect(date && toDatetimeLocalValue(date, NY)).toBe('2026-08-19T09:15')
  })

  it('resolves the nonexistent spring-forward slot to a real instant', () => {
    // 2:30 AM on 2026-03-08 does not exist in America/New_York.
    const date = wallTimeToUtc({ year: 2026, month: 3, day: 8, hour: 2, minute: 30 }, NY)
    const wall = getWallTime(date, NY)
    expect([1, 3]).toContain(wall.hour)
  })

  it('rejects malformed input', () => {
    expect(parseDatetimeLocal('yesterday', NY)).toBeNull()
    expect(parseDatetimeLocal('2026-13-01T10:00', NY)).toBeNull()
    expect(parseDatetimeLocal('2026-01-01T25:00', NY)).toBeNull()
  })
})

describe('dayBoundsUtc', () => {
  it('is 24h on a normal day', () => {
    const { start, end } = dayBoundsUtc({ year: 2026, month: 8, day: 19 }, NY)
    expect(end.getTime() - start.getTime()).toBe(24 * 3600 * 1000)
  })

  it('is 23h on spring-forward day and 25h on fall-back day', () => {
    const spring = dayBoundsUtc({ year: 2026, month: 3, day: 8 }, NY)
    expect(spring.end.getTime() - spring.start.getTime()).toBe(23 * 3600 * 1000)
    const fall = dayBoundsUtc({ year: 2026, month: 11, day: 1 }, NY)
    expect(fall.end.getTime() - fall.start.getTime()).toBe(25 * 3600 * 1000)
  })
})

describe('wall-date arithmetic', () => {
  it('addDays rolls months and years', () => {
    expect(addDays({ year: 2026, month: 8, day: 30 }, 3)).toEqual({
      year: 2026,
      month: 9,
      day: 2,
    })
    expect(addDays({ year: 2026, month: 1, day: 1 }, -1)).toEqual({
      year: 2025,
      month: 12,
      day: 31,
    })
  })

  it('weekday math is Monday-first', () => {
    // 2026-08-19 is a Wednesday.
    expect(weekdayIndex({ year: 2026, month: 8, day: 19 })).toBe(2)
    expect(startOfWeek({ year: 2026, month: 8, day: 19 })).toEqual({
      year: 2026,
      month: 8,
      day: 17,
    })
  })

  it('date keys round-trip', () => {
    expect(dateKey({ year: 2026, month: 3, day: 5 })).toBe('2026-03-05')
    expect(parseDateKey('2026-03-05')).toEqual({ year: 2026, month: 3, day: 5 })
    expect(parseDateKey('garbage')).toBeNull()
  })

  it('minutesIntoDay uses the zone wall clock', () => {
    const date = parseDatetimeLocal('2026-08-19T14:30', NY)
    expect(date && minutesIntoDay(date, NY)).toBe(870)
  })
})

describe('monthGrid', () => {
  it('covers August 2026 in six Monday-first weeks', () => {
    const weeks = monthGrid(2026, 8)
    expect(weeks).toHaveLength(6)
    expect(weeks[0]?.[0]).toEqual({ year: 2026, month: 7, day: 27 })
    expect(weeks[5]?.[6]).toEqual({ year: 2026, month: 9, day: 6 })
  })

  it('covers February 2026 in five weeks', () => {
    const weeks = monthGrid(2026, 2)
    expect(weeks).toHaveLength(5)
    expect(weeks[0]?.[0]).toEqual({ year: 2026, month: 1, day: 26 })
  })

  it('every week has seven days', () => {
    for (const week of monthGrid(2026, 12)) {
      expect(week).toHaveLength(7)
    }
  })
})

describe('minutesToHuman', () => {
  it('reads naturally', () => {
    expect(minutesToHuman(45)).toBe('45m')
    expect(minutesToHuman(60)).toBe('1h')
    expect(minutesToHuman(150)).toBe('2h 30m')
  })
})
