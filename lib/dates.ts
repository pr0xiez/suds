/**
 * All times are stored UTC and rendered in the business timezone from
 * Settings.timezone. Nothing here reads the server's local zone — the helpers
 * take an explicit IANA zone so behavior doesn't change with the host machine.
 *
 * "Wall" types are calendar values as a person in that zone would say them:
 * month is 1–12, never a Date object's 0-11.
 */

export interface WallDate {
  year: number
  month: number
  day: number
}

export interface WallTime extends WallDate {
  hour: number
  minute: number
}

// ---------------------------------------------------------------------------
// Zone conversion
// ---------------------------------------------------------------------------

const partsCache = new Map<string, Intl.DateTimeFormat>()

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let dtf = partsCache.get(timeZone)
  if (!dtf) {
    dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    partsCache.set(timeZone, dtf)
  }
  return dtf
}

/** The wall-clock reading of a UTC instant in a zone. */
export function getWallTime(date: Date, timeZone: string): WallTime & { second: number } {
  const fields: Record<string, number> = {}
  for (const part of partsFormatter(timeZone).formatToParts(date)) {
    if (part.type !== 'literal') fields[part.type] = Number(part.value)
  }
  return {
    year: fields.year ?? 1970,
    month: fields.month ?? 1,
    day: fields.day ?? 1,
    // Some engines render midnight as hour 24 with hour12: false.
    hour: (fields.hour ?? 0) % 24,
    minute: fields.minute ?? 0,
    second: fields.second ?? 0,
  }
}

function tzOffsetMs(date: Date, timeZone: string): number {
  const wall = getWallTime(date, timeZone)
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second)
  // Truncate to whole seconds to match the second-precision wall reading.
  return asUtc - Math.floor(date.getTime() / 1000) * 1000
}

/**
 * A wall-clock time in a zone → the UTC instant. Two passes settle DST edges;
 * a nonexistent time (spring-forward gap) resolves to the shifted instant.
 */
export function wallTimeToUtc(wall: WallTime, timeZone: string): Date {
  const utcGuess = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute)
  let ts = utcGuess - tzOffsetMs(new Date(utcGuess), timeZone)
  ts = utcGuess - tzOffsetMs(new Date(ts), timeZone)
  return new Date(ts)
}

/** `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm") → UTC instant. */
export function parseDatetimeLocal(value: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value.trim())
  if (!match) return null
  const [, y, mo, d, h, mi] = match
  const wall = {
    year: Number(y),
    month: Number(mo),
    day: Number(d),
    hour: Number(h),
    minute: Number(mi),
  }
  if (wall.month < 1 || wall.month > 12 || wall.day < 1 || wall.day > 31) return null
  if (wall.hour > 23 || wall.minute > 59) return null
  return wallTimeToUtc(wall, timeZone)
}

const pad = (n: number) => String(n).padStart(2, '0')

/** UTC instant → `<input type="datetime-local">` value in the zone. */
export function toDatetimeLocalValue(date: Date, timeZone: string): string {
  const w = getWallTime(date, timeZone)
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`
}

// ---------------------------------------------------------------------------
// Wall-date arithmetic (pure calendar math, no zone involved)
// ---------------------------------------------------------------------------

export function dateKey(wall: WallDate): string {
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}`
}

export function parseDateKey(key: string): WallDate | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key.trim())
  if (!match) return null
  const wall = { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
  if (wall.month < 1 || wall.month > 12 || wall.day < 1 || wall.day > 31) return null
  return wall
}

export function addDays(wall: WallDate, days: number): WallDate {
  const d = new Date(Date.UTC(wall.year, wall.month - 1, wall.day + days))
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() }
}

/** 0 = Monday … 6 = Sunday. */
export function weekdayIndex(wall: WallDate): number {
  const sundayFirst = new Date(Date.UTC(wall.year, wall.month - 1, wall.day)).getUTCDay()
  return (sundayFirst + 6) % 7
}

export function startOfWeek(wall: WallDate): WallDate {
  return addDays(wall, -weekdayIndex(wall))
}

export function isSameWallDate(a: WallDate, b: WallDate): boolean {
  return a.year === b.year && a.month === b.month && a.day === b.day
}

/** Weeks (Mon–Sun) covering a month, including leading/trailing spillover days. */
export function monthGrid(year: number, month: number): WallDate[][] {
  const first = { year, month, day: 1 }
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  let cursor = startOfWeek(first)
  const weeks: WallDate[][] = []
  const last = { year, month, day: daysInMonth }
  while (true) {
    const week: WallDate[] = []
    for (let i = 0; i < 7; i++) {
      week.push(cursor)
      cursor = addDays(cursor, 1)
    }
    weeks.push(week)
    const firstOfNext = week[6] && compareWallDates(week[6], last) >= 0
    if (firstOfNext) break
    if (weeks.length > 6) break
  }
  return weeks
}

export function compareWallDates(a: WallDate, b: WallDate): number {
  return dateKey(a) < dateKey(b) ? -1 : dateKey(a) > dateKey(b) ? 1 : 0
}

// ---------------------------------------------------------------------------
// Zone-anchored ranges
// ---------------------------------------------------------------------------

export function todayWall(timeZone: string, now = new Date()): WallDate {
  const w = getWallTime(now, timeZone)
  return { year: w.year, month: w.month, day: w.day }
}

/** [start, end) UTC instants of a wall date in a zone. */
export function dayBoundsUtc(wall: WallDate, timeZone: string): { start: Date; end: Date } {
  const start = wallTimeToUtc({ ...wall, hour: 0, minute: 0 }, timeZone)
  const next = addDays(wall, 1)
  const end = wallTimeToUtc({ ...next, hour: 0, minute: 0 }, timeZone)
  return { start, end }
}

/** Minutes past local midnight — used to position jobs on the day column. */
export function minutesIntoDay(date: Date, timeZone: string): number {
  const w = getWallTime(date, timeZone)
  return w.hour * 60 + w.minute
}

// ---------------------------------------------------------------------------
// Formatting (all in the given zone)
// ---------------------------------------------------------------------------

function fmt(timeZone: string, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-US', { timeZone, ...options })
}

export function formatTime(date: Date, timeZone: string): string {
  return fmt(timeZone, { hour: 'numeric', minute: '2-digit' }).format(date)
}

export function formatDate(date: Date, timeZone: string): string {
  return fmt(timeZone, { weekday: 'short', month: 'short', day: 'numeric' }).format(date)
}

export function formatFullDate(date: Date, timeZone: string): string {
  return fmt(timeZone, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function formatDateTime(date: Date, timeZone: string): string {
  return `${formatDate(date, timeZone)}, ${formatTime(date, timeZone)}`
}

/** Formats a wall date without any zone conversion. */
export function formatWallDate(
  wall: WallDate,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' },
): string {
  const utc = new Date(Date.UTC(wall.year, wall.month - 1, wall.day))
  return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...options }).format(utc)
}

export function formatMonthYear(year: number, month: number): string {
  return formatWallDate({ year, month, day: 1 }, { month: 'long', year: 'numeric' })
}

export function minutesToHuman(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
