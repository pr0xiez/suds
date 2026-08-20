import clsx from 'clsx'
import Link from 'next/link'
import { btnPrimary, btnSecondary, Card, EmptyState, PostStatusBadge } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import {
  dateKey,
  dayBoundsUtc,
  formatDateTime,
  formatMonthYear,
  getWallTime,
  isSameWallDate,
  monthGrid,
  todayWall,
} from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { getSettings } from '@/lib/ops/settings'

export const metadata = { title: 'Social' }

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function chipClass(status: string, overdue: boolean): string {
  if (overdue) return 'bg-rose-100 text-rose-800 hover:bg-rose-200'
  if (status === 'POSTED') return 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
  if (status === 'SCHEDULED') return 'bg-sky-100 text-sky-800 hover:bg-sky-200'
  return 'bg-slate-100 text-slate-600 hover:bg-slate-200'
}

export default async function SocialPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  await requireUser()
  const settings = await getSettings()
  const tz = settings.timezone
  const now = new Date()
  const today = todayWall(tz, now)

  const { month: monthParam } = await searchParams
  const match = /^(\d{4})-(\d{2})$/.exec(monthParam ?? '')
  const year = match ? Number(match[1]) : today.year
  const month =
    match && Number(match[2]) >= 1 && Number(match[2]) <= 12 ? Number(match[2]) : today.month

  const weeks = monthGrid(year, month)
  const firstCell = weeks[0]?.[0] ?? { year, month, day: 1 }
  const lastCell = weeks[weeks.length - 1]?.[6] ?? { year, month, day: 28 }
  const gridStart = dayBoundsUtc(firstCell, tz).start
  const gridEnd = dayBoundsUtc(lastCell, tz).end

  const prev = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 }
  const next = month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 }
  const monthKey = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`

  const [monthPosts, drafts, scheduled, posted] = await Promise.all([
    prisma.socialPost.findMany({
      where: {
        OR: [
          { scheduledFor: { gte: gridStart, lt: gridEnd } },
          { scheduledFor: null, postedAt: { gte: gridStart, lt: gridEnd } },
        ],
      },
      orderBy: { scheduledFor: 'asc' },
    }),
    prisma.socialPost.findMany({
      where: { status: 'DRAFT' },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.socialPost.findMany({
      where: { status: 'SCHEDULED' },
      orderBy: { scheduledFor: 'asc' },
      take: 12,
    }),
    prisma.socialPost.findMany({
      where: { status: 'POSTED' },
      orderBy: { postedAt: 'desc' },
      take: 5,
    }),
  ])

  const byDay = new Map<string, typeof monthPosts>()
  for (const post of monthPosts) {
    const when = post.scheduledFor ?? post.postedAt
    if (!when) continue
    const key = dateKey(getWallTime(when, tz))
    const list = byDay.get(key) ?? []
    list.push(post)
    byDay.set(key, list)
  }

  const overdueScheduled = scheduled.filter((p) => p.scheduledFor !== null && p.scheduledFor < now)
  const upcomingScheduled = scheduled.filter((p) => !p.scheduledFor || p.scheduledFor >= now)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Social</h1>
          <p className="mt-1 text-sm text-slate-500">{formatMonthYear(year, month)}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/social?month=${monthKey(prev.year, prev.month)}`} className={btnSecondary}>
            ← Prev
          </Link>
          <Link href="/social" className={btnSecondary}>
            This month
          </Link>
          <Link href={`/social?month=${monthKey(next.year, next.month)}`} className={btnSecondary}>
            Next →
          </Link>
          <Link href="/social/new" className={btnPrimary}>
            + New post
          </Link>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_18rem]">
        <Card padded={false}>
          <div className="overflow-x-auto">
            <div className="min-w-[720px]">
              <div className="grid grid-cols-7 border-b border-slate-200">
                {WEEKDAY_LABELS.map((label) => (
                  <p
                    key={label}
                    className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-slate-500"
                  >
                    {label}
                  </p>
                ))}
              </div>
              {weeks.map((week) => (
                <div
                  key={dateKey(week[0] ?? firstCell)}
                  className="grid grid-cols-7 border-b border-slate-100 last:border-b-0"
                >
                  {week.map((day) => {
                    const inMonth = day.month === month
                    const isToday = isSameWallDate(day, today)
                    const posts = byDay.get(dateKey(day)) ?? []
                    return (
                      <div
                        key={dateKey(day)}
                        className={clsx(
                          'min-h-24 border-r border-slate-100 p-1.5 last:border-r-0',
                          !inMonth && 'bg-slate-50/70',
                        )}
                      >
                        <p
                          className={clsx(
                            'mb-1 text-right text-xs tabular-nums',
                            isToday
                              ? 'font-bold text-cyan-700'
                              : inMonth
                                ? 'text-slate-600'
                                : 'text-slate-300',
                          )}
                        >
                          {day.day}
                        </p>
                        <div className="space-y-1">
                          {posts.slice(0, 3).map((post) => {
                            const overdue =
                              post.status === 'SCHEDULED' &&
                              post.scheduledFor !== null &&
                              post.scheduledFor < now
                            return (
                              <Link
                                key={post.id}
                                href={`/social/${post.id}`}
                                className={clsx(
                                  'block truncate rounded px-1.5 py-0.5 text-[11px] font-medium',
                                  chipClass(post.status, overdue),
                                )}
                              >
                                {post.caption.split('\n')[0]?.slice(0, 26) || 'Post'}
                              </Link>
                            )
                          })}
                          {posts.length > 3 ? (
                            <p className="px-1.5 text-[10px] text-slate-400">
                              +{posts.length - 3} more
                            </p>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          {overdueScheduled.length > 0 ? (
            <Card title="Overdue" className="border-rose-200">
              <ul className="space-y-2">
                {overdueScheduled.map((post) => (
                  <li key={post.id}>
                    <Link href={`/social/${post.id}`} className="block text-sm hover:underline">
                      <span className="font-medium text-rose-700">
                        {post.scheduledFor ? formatDateTime(post.scheduledFor, tz) : ''}
                      </span>
                      <span className="block truncate text-slate-600">
                        {post.caption.split('\n')[0] || 'No caption'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}

          <Card title="Up next">
            {upcomingScheduled.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing scheduled.</p>
            ) : (
              <ul className="space-y-2">
                {upcomingScheduled.map((post) => (
                  <li key={post.id}>
                    <Link href={`/social/${post.id}`} className="block text-sm hover:underline">
                      <span className="font-medium text-slate-800">
                        {post.scheduledFor ? formatDateTime(post.scheduledFor, tz) : 'Unscheduled'}
                      </span>
                      <span className="block truncate text-slate-500">
                        {post.caption.split('\n')[0] || 'No caption'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Drafts">
            {drafts.length === 0 ? (
              <p className="text-sm text-slate-500">No drafts.</p>
            ) : (
              <ul className="space-y-2">
                {drafts.map((post) => (
                  <li key={post.id}>
                    <Link
                      href={`/social/${post.id}`}
                      className="flex items-center justify-between gap-2 text-sm hover:underline"
                    >
                      <span className="truncate text-slate-600">
                        {post.caption.split('\n')[0] || 'Untitled draft'}
                      </span>
                      <PostStatusBadge status={post.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {posted.length > 0 ? (
            <Card title="Recently posted">
              <ul className="space-y-2">
                {posted.map((post) => (
                  <li key={post.id}>
                    <Link href={`/social/${post.id}`} className="block text-sm hover:underline">
                      <span className="font-medium text-slate-800">
                        {post.postedAt ? formatDateTime(post.postedAt, tz) : ''}
                      </span>
                      <span className="block truncate text-slate-500">
                        {post.caption.split('\n')[0] || 'No caption'}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
        </div>
      </div>

      {monthPosts.length === 0 && drafts.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No posts yet"
            hint="Finish a job with photos, then hit “Create post from this job.”"
          />
        </div>
      ) : null}
    </div>
  )
}
