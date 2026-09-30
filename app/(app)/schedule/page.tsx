import clsx from 'clsx'
import Link from 'next/link'
import { btnPrimary, btnSecondary, Card, JOB_STATUS_META } from '@/components/ui'
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
import { getSettings } from '@/lib/ops/settings'

export const metadata = { title: 'Schedule' }

const HOUR_PX = 56
const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Schedule</h1>
          <p className="mt-1 text-sm text-slate-500">
            {formatWallDate(firstDay)} –{' '}
            {formatWallDate(lastDay, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/schedule?week=${dateKey(addDays(weekStart, -7))}`} className={btnSecondary}>
            ← Prev
          </Link>
          <Link href="/schedule" className={btnSecondary}>
            Today
          </Link>
          <Link href={`/schedule?week=${dateKey(addDays(weekStart, 7))}`} className={btnSecondary}>
            Next →
          </Link>
          <Link href="/jobs/new" className={btnPrimary}>
            + New job
          </Link>
        </div>
      </div>

      <Card padded={false}>
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Day headers */}
            <div
              className="grid border-b border-slate-200"
              style={{ gridTemplateColumns: '3.5rem repeat(7, 1fr)' }}
            >
              <div />
              {days.map((day, i) => {
                const isToday = isSameWallDate(day, today)
                return (
                  <div
                    key={dateKey(day)}
                    className={clsx(
                      'border-l border-slate-100 px-2 py-2 text-center',
                      isToday && 'bg-cyan-50',
                    )}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {WEEKDAY_LABELS[i]}
                    </p>
                    <p
                      className={clsx(
                        'text-lg font-bold tabular-nums',
                        isToday ? 'text-cyan-700' : 'text-slate-800',
                      )}
                    >
                      {day.day}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Time grid */}
            <div className="grid" style={{ gridTemplateColumns: '3.5rem repeat(7, 1fr)' }}>
              {/* Hour gutter */}
              <div className="relative" style={{ height: colHeight }}>
                {hours.map((hour, i) => (
                  <span
                    key={hour}
                    className="absolute right-2 -translate-y-1/2 text-[10px] font-medium text-slate-400"
                    style={{ top: i * HOUR_PX }}
                  >
                    {i === 0 ? '' : hourLabel(hour)}
                  </span>
                ))}
              </div>

              {days.map((day) => {
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
                      'relative border-l border-slate-100',
                      isToday && 'bg-cyan-50/40',
                    )}
                    style={{ height: colHeight }}
                  >
                    {/* Empty-slot links: click an hour to book it */}
                    {hours.map((hour, i) => (
                      <Link
                        key={hour}
                        href={`/jobs/new?at=${dayKey}T${String(hour).padStart(2, '0')}:00`}
                        title={`New job ${formatWallDate(day)} at ${hourLabel(hour)}`}
                        className="absolute inset-x-0 border-t border-slate-100 hover:bg-cyan-100/40"
                        style={{ top: i * HOUR_PX, height: HOUR_PX }}
                      />
                    ))}

                    {positioned.map(({ item, lane, lanes }) => {
                      const pct = spanToPct(item)
                      const meta = JOB_STATUS_META[item.job.status]
                      return (
                        <Link
                          key={item.job.id}
                          href={`/jobs/${item.job.id}`}
                          className={clsx(
                            'absolute z-10 overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-[11px] leading-tight shadow-sm',
                            meta.chip,
                          )}
                          style={{
                            top: `${pct.top}%`,
                            height: `${pct.height}%`,
                            left: `calc(${(lane / lanes) * 100}% + 2px)`,
                            width: `calc(${100 / lanes}% - 4px)`,
                          }}
                        >
                          <span className="block font-semibold">
                            {formatTime(item.job.scheduledAt, tz)}
                          </span>
                          <span className="block truncate">{item.job.customer.name}</span>
                          <span className="block truncate opacity-75">
                            {item.job.vehicle.make} {item.job.vehicle.model}
                          </span>
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
      <p className="mt-3 text-xs text-slate-400">
        Click an empty slot to book it. Jobs outside 7 AM–8 PM clamp to the edge of the grid.
      </p>
    </div>
  )
}
