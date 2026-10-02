import {
  CalendarBlankIcon,
  CaretLeftIcon,
  CaretRightIcon,
  FilmSlateIcon,
  MegaphoneIcon,
  PlusIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import Link from 'next/link'
import {
  btnPrimary,
  btnSecondary,
  btnSmall,
  Card,
  EmptyState,
  PageHeader,
  PLATFORM_META,
  PlatformChips,
  POST_STATUS_META,
  PostStatusBadge,
  type Tone,
} from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import {
  dateKey,
  dayBoundsUtc,
  formatDateTime,
  formatMonthYear,
  formatTime,
  formatWallDate,
  getWallTime,
  isSameWallDate,
  monthGrid,
  todayWall,
} from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import type { Platform, PostStatus } from '@/lib/generated/prisma/enums'
import { getSettings } from '@/lib/ops/settings'

export const metadata = { title: 'Social' }

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

/** Left-edge calendar chips, one per status tone (mirrors the job calendar blocks). */
const CHIP_TONE: Record<Tone, string> = {
  neutral: 'border-line-strong bg-surface-2 text-ink-muted hover:bg-surface-3',
  info: 'border-info bg-info-soft text-ink hover:border-ink',
  warn: 'border-warn bg-warn-soft text-ink hover:border-ink',
  ok: 'border-ok bg-ok-soft text-ink hover:border-ink',
  danger: 'border-danger bg-danger-soft text-ink hover:border-ink',
  accent: 'border-accent-ink bg-accent-soft text-ink hover:border-ink',
}

const LEGEND: Array<{ label: string; swatch: string }> = [
  { label: 'Draft', swatch: 'bg-line-strong' },
  { label: 'Scheduled', swatch: 'bg-info' },
  { label: 'Posted', swatch: 'bg-ok' },
  { label: 'Overdue', swatch: 'bg-danger' },
]

function postTone(status: PostStatus, overdue: boolean): { tone: Tone; label: string } {
  if (overdue) return { tone: 'danger', label: 'Overdue' }
  const meta = POST_STATUS_META[status]
  return { tone: meta.tone, label: meta.label }
}

/** Up to two platform glyphs, then a count, so chips stay one line in narrow cells. */
function PlatformGlyphs({ platforms }: { platforms: Platform[] }) {
  if (platforms.length === 0) return null
  const shown = platforms.slice(0, 2)
  return (
    <span className="flex shrink-0 items-center gap-0.5">
      {shown.map((platform) => {
        const PlatformIcon = PLATFORM_META[platform].icon
        return <PlatformIcon key={platform} aria-hidden className="size-3" />
      })}
      {platforms.length > 2 ? (
        <span className="text-[10px] tabular-nums">+{platforms.length - 2}</span>
      ) : null}
      <span className="sr-only">
        {platforms.map((platform) => PLATFORM_META[platform].label).join(', ')}:
      </span>
    </span>
  )
}

const queueRow = 'block px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5'

export default async function SocialPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  const user = await requireUser()
  const settings = await getSettings(user.businessId)
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
        businessId: user.businessId,
        OR: [
          { scheduledFor: { gte: gridStart, lt: gridEnd } },
          { scheduledFor: null, postedAt: { gte: gridStart, lt: gridEnd } },
        ],
      },
      orderBy: { scheduledFor: 'asc' },
    }),
    prisma.socialPost.findMany({
      where: { businessId: user.businessId, status: 'DRAFT' },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
    prisma.socialPost.findMany({
      where: { businessId: user.businessId, status: 'SCHEDULED' },
      orderBy: { scheduledFor: 'asc' },
      take: 12,
    }),
    prisma.socialPost.findMany({
      where: { businessId: user.businessId, status: 'POSTED' },
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

  const isOverdue = (post: (typeof monthPosts)[number]) =>
    post.status === 'SCHEDULED' && post.scheduledFor !== null && post.scheduledFor < now

  // Phone agenda: the days of this month that have something on them.
  const agendaDays = weeks
    .flat()
    .filter((day) => day.month === month)
    .map((day) => ({ day, posts: byDay.get(dateKey(day)) ?? [] }))
    .filter((entry) => entry.posts.length > 0)

  const monthNav = (
    <div className="flex items-center gap-1">
      <Link
        href={`/social?month=${monthKey(prev.year, prev.month)}`}
        aria-label="Previous month"
        title="Previous month"
        className={clsx(btnSecondary, 'min-h-8! w-8 px-0! [&_svg]:size-3.5!')}
      >
        <CaretLeftIcon aria-hidden />
      </Link>
      <Link href="/social" className={clsx(btnSecondary, btnSmall)}>
        This month
      </Link>
      <Link
        href={`/social?month=${monthKey(next.year, next.month)}`}
        aria-label="Next month"
        title="Next month"
        className={clsx(btnSecondary, 'min-h-8! w-8 px-0! [&_svg]:size-3.5!')}
      >
        <CaretRightIcon aria-hidden />
      </Link>
    </div>
  )

  return (
    <div>
      <PageHeader
        title="Content calendar"
        subtitle="Plan posts, copy them into each app, then mark them posted."
        actions={
          <>
            <Link href="/social/shorts" className={btnSecondary}>
              <FilmSlateIcon aria-hidden />
              Edit a short
            </Link>
            <Link href="/social/new" className={btnPrimary}>
              <PlusIcon aria-hidden />
              New post
            </Link>
          </>
        }
      />

      <Card
        className="overflow-hidden"
        title={<span className="text-base">{formatMonthYear(year, month)}</span>}
        actions={monthNav}
        padded={false}
      >
        {/* Month grid: laptops and up */}
        <div className="hidden lg:block">
          <div className="grid grid-cols-7 border-b border-line bg-surface-2/60">
            {WEEKDAY_LABELS.map((label) => (
              <p key={label} className="px-2.5 py-2 text-xs font-medium text-ink-muted">
                {label}
              </p>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-line">
            {weeks.flat().map((day) => {
              const inMonth = day.month === month
              const isToday = isSameWallDate(day, today)
              const posts = byDay.get(dateKey(day)) ?? []
              return (
                <div
                  key={dateKey(day)}
                  className={clsx(
                    'flex min-h-28 min-w-0 flex-col gap-1 p-1.5',
                    inMonth ? 'bg-surface' : 'bg-canvas',
                  )}
                >
                  <p className="flex">
                    <span
                      className={clsx(
                        'grid size-6 place-items-center rounded-full text-xs tabular-nums',
                        isToday
                          ? 'bg-accent font-semibold text-on-accent'
                          : inMonth
                            ? 'font-medium text-ink'
                            : 'text-ink-faint',
                      )}
                    >
                      {day.day}
                    </span>
                    {isToday ? <span className="sr-only">(today)</span> : null}
                  </p>
                  <div className="space-y-1">
                    {posts.slice(0, 3).map((post) => {
                      const overdue = isOverdue(post)
                      const { tone, label } = postTone(post.status, overdue)
                      const when = post.scheduledFor ?? post.postedAt
                      const caption = post.caption.split('\n')[0]?.slice(0, 26) || 'Post'
                      return (
                        <Link
                          key={post.id}
                          href={`/social/${post.id}`}
                          title={`${label}${when ? `, ${formatTime(when, tz)}` : ''}: ${caption}`}
                          className={clsx(
                            'flex min-w-0 items-center gap-1 rounded-tight border-l-2 px-1.5 py-1 text-[11px] font-medium leading-tight transition-colors',
                            CHIP_TONE[tone],
                          )}
                        >
                          <PlatformGlyphs platforms={post.platforms} />
                          <span className="min-w-0 truncate">{caption}</span>
                          <span className="sr-only">, {label}</span>
                        </Link>
                      )
                    })}
                    {posts.length > 3 ? (
                      <p className="px-1.5 text-[11px] text-ink-faint">+{posts.length - 3} more</p>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
          <ul
            aria-label="Status colors"
            className="flex flex-wrap gap-x-5 gap-y-1 border-t border-line px-5 py-3 text-xs text-ink-muted"
          >
            {LEGEND.map((item) => (
              <li key={item.label} className="inline-flex items-center gap-1.5">
                <span aria-hidden className={clsx('h-3 w-1 rounded-full', item.swatch)} />
                {item.label}
              </li>
            ))}
          </ul>
        </div>

        {/* Agenda: phones and tablets */}
        <div className="lg:hidden">
          {agendaDays.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyState
                icon={CalendarBlankIcon}
                title={`Nothing on the calendar for ${formatMonthYear(year, month)}`}
              />
            </div>
          ) : (
            <ol className="divide-y divide-line">
              {agendaDays.map(({ day, posts }) => {
                const isToday = isSameWallDate(day, today)
                return (
                  <li key={dateKey(day)} className="flex gap-3 px-4 py-3 sm:px-5">
                    <div className="flex w-10 shrink-0 flex-col items-center pt-0.5">
                      <span className="text-xs text-ink-muted">
                        {formatWallDate(day, { weekday: 'short' })}
                      </span>
                      <span
                        className={clsx(
                          'mt-0.5 grid size-8 place-items-center rounded-full text-sm font-semibold tabular-nums',
                          isToday ? 'bg-accent text-on-accent' : 'text-ink',
                        )}
                      >
                        {day.day}
                      </span>
                      {isToday ? <span className="sr-only">(today)</span> : null}
                    </div>
                    <ul className="min-w-0 flex-1 space-y-1.5">
                      {posts.map((post) => {
                        const overdue = isOverdue(post)
                        const { tone } = postTone(post.status, overdue)
                        const when = post.scheduledFor ?? post.postedAt
                        return (
                          <li key={post.id}>
                            <Link
                              href={`/social/${post.id}`}
                              className={clsx(
                                'block rounded-tight border-l-2 px-2.5 py-2 transition-colors',
                                CHIP_TONE[tone],
                              )}
                            >
                              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <PlatformChips platforms={post.platforms} />
                                <span className="text-xs tabular-nums text-ink-muted">
                                  {when ? formatTime(when, tz) : ''}
                                </span>
                                <span className="ml-auto">
                                  <PostStatusBadge status={post.status} overdue={overdue} />
                                </span>
                              </span>
                              <span className="mt-1 block truncate text-sm text-ink">
                                {post.caption.split('\n')[0] || 'Post'}
                              </span>
                            </Link>
                          </li>
                        )
                      })}
                    </ul>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
      </Card>

      <section className="mt-10">
        <h2 className="font-display text-lg font-bold text-ink">Post queue</h2>
        <div className="mt-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            {overdueScheduled.length > 0 ? (
              <Card
                title={
                  <span className="inline-flex items-center gap-1.5 text-danger">
                    <WarningCircleIcon aria-hidden className="size-4" />
                    Overdue
                  </span>
                }
                className="border-danger-line"
                padded={false}
              >
                <ul className="divide-y divide-line">
                  {overdueScheduled.map((post) => (
                    <li key={post.id}>
                      <Link href={`/social/${post.id}`} className={queueRow}>
                        <span className="flex flex-wrap items-center gap-2">
                          <PlatformChips platforms={post.platforms} />
                          <span className="text-xs font-medium text-danger">
                            {post.scheduledFor ? formatDateTime(post.scheduledFor, tz) : ''}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-sm text-ink">
                          {post.caption.split('\n')[0] || 'No caption'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            <Card title="Up next" padded={false}>
              {upcomingScheduled.length === 0 ? (
                <p className="px-4 py-4 text-sm text-ink-muted sm:px-5">Nothing scheduled.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {upcomingScheduled.map((post) => (
                    <li key={post.id}>
                      <Link href={`/social/${post.id}`} className={queueRow}>
                        <span className="flex flex-wrap items-center gap-2">
                          <PlatformChips platforms={post.platforms} />
                          <span className="text-xs font-medium tabular-nums text-ink-muted">
                            {post.scheduledFor
                              ? formatDateTime(post.scheduledFor, tz)
                              : 'Unscheduled'}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-sm text-ink">
                          {post.caption.split('\n')[0] || 'No caption'}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="space-y-6">
            <Card title="Drafts" padded={false}>
              {drafts.length === 0 ? (
                <p className="px-4 py-4 text-sm text-ink-muted sm:px-5">No drafts.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {drafts.map((post) => (
                    <li key={post.id}>
                      <Link
                        href={`/social/${post.id}`}
                        className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5"
                      >
                        <span className="min-w-0 truncate text-sm text-ink">
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
              <Card title="Recently posted" padded={false}>
                <ul className="divide-y divide-line">
                  {posted.map((post) => (
                    <li key={post.id}>
                      <Link href={`/social/${post.id}`} className={queueRow}>
                        <span className="flex flex-wrap items-center gap-2">
                          <PlatformChips platforms={post.platforms} />
                          <span className="text-xs font-medium tabular-nums text-ink-muted">
                            {post.postedAt ? formatDateTime(post.postedAt, tz) : ''}
                          </span>
                        </span>
                        <span className="mt-1 block truncate text-sm text-ink">
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
      </section>

      {monthPosts.length === 0 && drafts.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={MegaphoneIcon}
            title="No posts yet"
            hint="Finish a job with photos, then hit “Create post from this job.”"
          />
        </div>
      ) : null}
    </div>
  )
}
