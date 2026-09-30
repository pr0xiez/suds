import {
  addDays,
  dateKey,
  getWallTime,
  parseDateKey,
  todayWall,
  wallTimeToUtc,
  weekdayIndex,
} from '@/lib/dates'

export interface WorkingWindow {
  /** Monday = 0, Sunday = 6. Multiple windows support a lunch break. */
  day: number
  start: string
  end: string
}

export interface BusyInterval {
  start: Date
  end: Date
}

export interface BookingRules {
  timezone: string
  workingHours: unknown
  travelBufferMin: number
  leadTimeMin: number
  horizonDays: number
}

export const DEFAULT_WORKING_HOURS: WorkingWindow[] = Array.from({ length: 5 }, (_, day) => ({
  day,
  start: '09:00',
  end: '17:00',
}))

/** The zone abbreviation distinguishes the two 1 AM slots when clocks fall back. */
export function bookingTimeLabel(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(date)
}

/** Browser selections carry canonical UTC instants; never interpret an unzoned string in the server's timezone. */
export function parseBookingInstant(value: unknown): Date | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : null
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value))
    return null
  const date = new Date(value)
  return Number.isFinite(date.getTime()) && date.toISOString() === value ? date : null
}

function minuteValue(value: string): number | null {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) return null
  return Number(value.slice(0, 2)) * 60 + Number(value.slice(3))
}

export function parseWorkingHours(value: unknown): WorkingWindow[] {
  if (!Array.isArray(value) || value.length > 28) throw new Error('Check your working hours')
  const windows = value.map((raw: unknown) => {
    if (!raw || typeof raw !== 'object') throw new Error('Check your working hours')
    const row = raw as Record<string, unknown>
    if (
      !Number.isInteger(row.day) ||
      Number(row.day) < 0 ||
      Number(row.day) > 6 ||
      typeof row.start !== 'string' ||
      typeof row.end !== 'string'
    )
      throw new Error('Check your working hours')
    const start = minuteValue(row.start)
    const end = minuteValue(row.end)
    if (start === null || end === null || end <= start) {
      throw new Error('Each working window must end after it starts on the same day')
    }
    return { day: Number(row.day), start: row.start, end: row.end }
  })
  const sorted = windows.sort((a, b) => a.day - b.day || a.start.localeCompare(b.start))
  for (let index = 1; index < sorted.length; index++) {
    const previous = sorted[index - 1]
    const current = sorted[index]
    if (previous && current && previous.day === current.day && previous.end > current.start) {
      throw new Error('Working windows cannot overlap')
    }
  }
  return sorted
}

export function overlaps(a: BusyInterval, b: BusyInterval): boolean {
  return a.start.getTime() < b.end.getTime() && b.start.getTime() < a.end.getTime()
}

export function reservationInterval(
  start: Date,
  durationMin: number,
  bufferMin: number,
): BusyInterval {
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isInteger(durationMin) ||
    durationMin < 15 ||
    durationMin > 1440
  ) {
    throw new Error('Pick a valid appointment duration')
  }
  return { start, end: new Date(start.getTime() + (durationMin + bufferMin) * 60_000) }
}

/** UTC stepping visits both repeated fall-back times and never invents a spring-gap time. */
export function availableSlots(
  rules: BookingRules,
  day: string,
  durationMin: number,
  busy: BusyInterval[],
  now = new Date(),
): Date[] {
  const wall = parseDateKey(day)
  if (!wall || dateKey(addDays(wall, 0)) !== day) return []
  const firstDay = dateKey(todayWall(rules.timezone, now))
  const lastDay = dateKey(addDays(todayWall(rules.timezone, now), rules.horizonDays))
  if (day < firstDay || day > lastDay) return []
  const windows = parseWorkingHours(rules.workingHours).filter((w) => w.day === weekdayIndex(wall))
  const earliest = now.getTime() + rules.leadTimeMin * 60_000
  const result = new Map<number, Date>()
  for (const window of windows) {
    const startMinute = minuteValue(window.start) ?? 0
    const endMinute = minuteValue(window.end) ?? 0
    const start = wallTimeToUtc(
      { ...wall, hour: Math.floor(startMinute / 60), minute: startMinute % 60 },
      rules.timezone,
    )
    const end = wallTimeToUtc(
      { ...wall, hour: Math.floor(endMinute / 60), minute: endMinute % 60 },
      rules.timezone,
    )
    // Scan a generous UTC range; checking wall readings preserves intended local hours at DST edges.
    for (
      let instant = Math.ceil((start.getTime() - 60 * 60_000) / (15 * 60_000)) * 15 * 60_000;
      instant < end.getTime() + 60 * 60_000;
      instant += 15 * 60_000
    ) {
      if (instant < earliest) continue
      const candidate = new Date(instant)
      const reading = getWallTime(candidate, rules.timezone)
      const localMinute = reading.hour * 60 + reading.minute
      if (
        dateKey(reading) !== day ||
        localMinute < startMinute ||
        localMinute >= endMinute ||
        reading.minute % 15 !== 0
      )
        continue
      const reservation = reservationInterval(candidate, durationMin, rules.travelBufferMin)
      const endReading = getWallTime(reservation.end, rules.timezone)
      const localEnd = endReading.hour * 60 + endReading.minute
      // Bound in UTC as well so a repeated clock hour cannot exceed the real closing instant.
      if (
        dateKey(endReading) !== day ||
        localEnd > endMinute ||
        reservation.end.getTime() > end.getTime()
      )
        continue
      if (!busy.some((interval) => overlaps(reservation, interval))) result.set(instant, candidate)
    }
  }
  return [...result.values()].sort((a, b) => a.getTime() - b.getTime())
}

export function assertPublicSlot(
  rules: BookingRules,
  start: Date,
  durationMin: number,
  now = new Date(),
): void {
  const day = dateKey(getWallTime(start, rules.timezone))
  if (
    !availableSlots(rules, day, durationMin, [], now).some(
      (slot) => slot.getTime() === start.getTime(),
    )
  ) {
    throw new Error(
      'That time is outside booking hours or too close to the appointment. Choose another time.',
    )
  }
}
