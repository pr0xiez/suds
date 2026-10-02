import { CaretLeftIcon, CaretRightIcon, PlusIcon } from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import Link from 'next/link'
import { btnPrimary, Card, JOB_STATUS_META, PageHeader, type Tone } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { assignLanes, hourLabel, spanToPct, windowHours } from '@/lib/calendar'
import {
  addDays,
  dateKey,
  dayBoundsUtc,
  formatTime,
  formatWallDate,
  getWallTime,
  isSameWallDate,
  minutesIntoDay,
  parseDateKey,
  startOfWeek,
  todayWall,
} from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import type { JobStatus } from '@/lib/generated/prisma/enums'
import { getSettings } from '@/lib/ops/settings'

export const metadata = { title: 'Schedule' }

const HOUR_PX = 56
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const GRID_COLUMNS = '3.5rem repeat(7, minmax(0, 1fr))'

/** Legend swatches: the same tone as each status's calendar block edge. */
const TONE_DOT: Record<Tone, string> = {
  neutral: 'bg-line-strong',
  info: 'bg-info',
  warn: 'bg-warn',
  ok: 'bg-ok',
  danger: 'bg-danger',
  accent: 'bg-accent-ink',
}
const LEGEND: JobStatus[] = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW']

const navButton =
  'inline-flex min-h-10 items-center justify-center text-sm font-medium text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink'

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>
}) {
  const user = await requireUser()
  const settings = await getSettings(user.businessId)
  const tz = settings.timezone
  const { week } = await searchParams

  const today = todayWall(tz)
  const anchor = (week ? parseDateKey(week) : null) ?? today
  const weekStart = startOfWeek(anchor)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const firstDay = days[0] ?? weekStart
  const lastDay = days[6] ?? weekStart

  const rangeStart = dayBoundsUtc(firstDay, tz).start
  const rangeEnd = dayBoundsUtc(lastDay, tz).end
  const jobs = await prisma.job.findMany({
    where: { businessId: user.businessId, scheduledAt: { gte: rangeStart, lt: rangeEnd } },
    include: { customer: true, vehicle: true },
    orderBy: { scheduledAt: 'asc' },
  })

  const byDay = new Map<string, typeof jobs>()
  for (const job of jobs) {
    const key = dateKey(getWallTime(job.scheduledAt, tz))
    const list = byDay.get(key) ?? []
    list.push(job)
    byDay.set(key, list)
  }

  const hours = windowHours()
  const colHeight = hours.length * HOUR_PX

  return (
    <div>
      <PageHeader
        title="Schedule"
        subtitle={
          <span className="tabular-nums">
            {formatWallDate(firstDay)}-
            {formatWallDate(lastDay, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </span>
        }
        actions={
          <>
            <nav
              aria-label="Week"
              className="inline-flex items-stretch overflow-hidden rounded-control border border-line-strong/70 bg-surface shadow-panel"
            >
              <Link
                href={`/schedule?week=${dateKey(addDays(weekStart, -7))}`}
                aria-label="Previous week"
                title="Previous week"
                className={clsx(navButton, 'w-10')}
              >
                <CaretLeftIcon aria-hidden className="size-4" />
              </Link>
              <Link
                href="/schedule"
                className={clsx(navButton, 'border-x border-line px-3.5 text-ink')}
              >
                Today
              </Link>
              <Link
                href={`/schedule?week=${dateKey(addDays(weekStart, 7))}`}
                aria-label="Next week"
                title="Next week"
                className={clsx(navButton, 'w-10')}
              >
                <CaretRightIcon aria-hidden className="size-4" />
              </Link>
            </nav>
            <Link href="/jobs/new" className={btnPrimary}>
              <PlusIcon aria-hidden />
              New job
            </Link>
          </>
        }
      />

      <Card padded={false} className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Day headers */}
            <div
              className="grid border-b border-line"
              style={{ gridTemplateColumns: GRID_COLUMNS }}
            >
              <div className="sticky left-0 z-20 border-r border-line bg-surface" />
              {days.map((day, i) => {
                const isToday = isSameWallDate(day, today)
                return (
                  <div
                    key={dateKey(day)}
                    aria-current={isToday ? 'date' : undefined}
                    className={clsx(
                      'flex flex-col items-center gap-1 px-2 py-2.5',
                      i > 0 && 'border-l border-line',
                      isToday && 'bg-accent-soft/40',
                    )}
                  >
                    <span
                      className={clsx(
                        'text-xs font-medium',
                        isToday ? 'text-ink' : 'text-ink-muted',
                      )}
                    >
                      {WEEKDAY_LABELS[i]}
                    </span>
                    <span
                      className={clsx(
                        'grid size-8 place-items-center rounded-full text-base font-semibold tabular-nums',
                        isToday ? 'bg-accent text-on-accent' : 'text-ink',
                      )}
                    >
                      {day.day}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Time grid */}
            <div className="grid" style={{ gridTemplateColumns: GRID_COLUMNS }}>
              {/* Hour gutter: stays put while the week scrolls sideways on a phone */}
              <div
                className="sticky left-0 z-20 border-r border-line bg-surface"
                style={{ height: colHeight }}
              >
                {hours.map((hour, i) => (
                  <span
                    key={hour}
                    className="absolute right-2 -translate-y-1/2 whitespace-nowrap text-[11px] font-medium tabular-nums text-ink-faint"
                    style={{ top: i * HOUR_PX }}
                  >
                    {i === 0 ? '' : hourLabel(hour)}
                  </span>
                ))}
              </div>

              {days.map((day, dayIndex) => {
                const dayKey = dateKey(day)
                const dayJobs = byDay.get(dayKey) ?? []
                const positioned = assignLanes(
                  dayJobs.map((job) => {
                    const startMin = minutesIntoDay(job.scheduledAt, tz)
                    return { startMin, endMin: startMin + job.durationMin, job }
                  }),
                )
                const isToday = isSameWallDate(day, today)
                return (
                  <div
                    key={dayKey}
                    className={clsx(
                      'relative',
                      dayIndex > 0 && 'border-l border-line',
                      isToday && 'bg-accent-soft/25',
                    )}
                    style={{ height: colHeight }}
                  >
                    {/* Empty-slot links: click an hour to book it */}
                    {hours.map((hour, i) => (
                      <Link
                        key={hour}
                        href={`/jobs/new?at=${dayKey}T${String(hour).padStart(2, '0')}:00`}
                        title={`New job ${formatWallDate(day)} at ${hourLabel(hour)}`}
                        aria-label={`New job ${formatWallDate(day)} at ${hourLabel(hour)}`}
                        className={clsx(
                          'group absolute inset-x-0 flex items-start justify-end p-1.5 transition-colors hover:bg-surface-2',
                          i > 0 && 'border-t border-line',
                        )}
                        style={{ top: i * HOUR_PX, height: HOUR_PX }}
                      >
                        <span
                          aria-hidden
                          className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line/70"
                        />
                        <PlusIcon
                          aria-hidden
                          className="relative size-3.5 text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                        />
                      </Link>
                    ))}

                    {positioned.map(({ item, lane, lanes }) => {
                      const pct = spanToPct(item)
                      const meta = JOB_STATUS_META[item.job.status]
                      return (
                        <Link
                          key={item.job.id}
                          href={`/jobs/${item.job.id}`}
                          title={`${formatTime(item.job.scheduledAt, tz)}, ${item.job.customer.name}: ${meta.label}`}
                          className={clsx(
                            'absolute z-10 overflow-hidden rounded-tight border-l-[3px] px-1.5 py-1 text-[11px] leading-snug shadow-panel transition-colors',
                            meta.chip,
                          )}
                          style={{
                            top: `${pct.top}%`,
                            height: `${pct.height}%`,
                            left: `calc(${(lane / lanes) * 100}% + 2px)`,
                            width: `calc(${100 / lanes}% - 4px)`,
                          }}
                        >
                          <span className="block font-semibold tabular-nums">
                            {formatTime(item.job.scheduledAt, tz)}
                          </span>
                          <span className="block truncate font-medium">
                            {item.job.customer.name}
                          </span>
                          <span className="block truncate text-ink-muted">
                            {item.job.vehicle.make} {item.job.vehicle.model}
                          </span>
                          <span className="sr-only">, {meta.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </Card>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-xs text-ink-muted">
          Click an empty slot to book it. Jobs outside 7 AM-8 PM clamp to the edge of the grid.
        </p>
        <ul aria-label="Status colors" className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
          {LEGEND.map((status) => (
            <li key={status} className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
              <span
                aria-hidden
                className={clsx('size-2 rounded-full', TONE_DOT[JOB_STATUS_META[status].tone])}
              />
              {JOB_STATUS_META[status].label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
