import Link from 'next/link'
import { markPostedAction } from '@/app/actions/social'
import {
  btnSecondary,
  btnSmall,
  Card,
  EmptyState,
  JobStatusBadge,
  PlatformChips,
  StatTile,
} from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import {
  dayBoundsUtc,
  formatDate,
  formatDateTime,
  formatFullDate,
  formatTime,
  todayWall,
  wallTimeToUtc,
} from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { formatCents, jobTotalCents } from '@/lib/money'
import { getSettings } from '@/lib/ops/settings'

export const metadata = { title: 'Dashboard' }

export default async function DashboardPage() {
  await requireUser()
  const settings = await getSettings()
  const tz = settings.timezone
  const now = new Date()
  const today = todayWall(tz, now)
  const { start: dayStart, end: dayEnd } = dayBoundsUtc(today, tz)
  const monthStart = wallTimeToUtc({ ...today, day: 1, hour: 0, minute: 0 }, tz)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [todayJobs, paidThisMonth, unpaid, queuedPosts, draftCount, photoGaps] = await Promise.all([
    prisma.job.findMany({
      where: { scheduledAt: { gte: dayStart, lt: dayEnd } },
      include: { customer: true, vehicle: true, items: true },
      orderBy: { scheduledAt: 'asc' },
    }),
    prisma.job.findMany({ where: { paidAt: { gte: monthStart } }, include: { items: true } }),
    prisma.job.findMany({
      where: { status: 'COMPLETED', paidAt: null },
      include: { customer: true, items: true },
      orderBy: { completedAt: 'desc' },
      take: 8,
    }),
    prisma.socialPost.findMany({
      where: { status: 'SCHEDULED' },
      include: { photos: { include: { photo: true }, orderBy: { sort: 'asc' } } },
      orderBy: { scheduledFor: 'asc' },
      take: 10,
    }),
    prisma.socialPost.count({ where: { status: 'DRAFT' } }),
    prisma.job.findMany({
      where: { status: 'COMPLETED', completedAt: { gte: weekAgo }, photos: { none: {} } },
      include: { customer: true, vehicle: true },
      orderBy: { completedAt: 'desc' },
      take: 5,
    }),
  ])

  const activeToday = todayJobs.filter((job) => job.status !== 'CANCELED')
  const todayValue = activeToday.reduce((sum, job) => sum + jobTotalCents(job), 0)
  const monthRevenue = paidThisMonth.reduce(
    (sum, job) => sum + jobTotalCents(job) + job.tipCents,
    0,
  )
  const unpaidTotal = unpaid.reduce((sum, job) => sum + jobTotalCents(job), 0)
  const overduePosts = queuedPosts.filter(
    (post) => post.scheduledFor !== null && post.scheduledFor < now,
  )
  const upcomingPosts = queuedPosts.filter(
    (post) => post.scheduledFor === null || post.scheduledFor >= now,
  )

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">{formatFullDate(now, tz)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Today's jobs"
          value={activeToday.length}
          detail={activeToday.length > 0 ? `${formatCents(todayValue)} on the books` : 'Open day'}
          href="/schedule"
        />
        <StatTile
          label="Collected this month"
          value={formatCents(monthRevenue)}
          detail={`${paidThisMonth.length} paid job${paidThisMonth.length === 1 ? '' : 's'}`}
          href="/jobs?when=past"
        />
        <StatTile
          label="Awaiting payment"
          value={formatCents(unpaidTotal)}
          detail={`${unpaid.length} completed job${unpaid.length === 1 ? '' : 's'}`}
          href="/jobs?status=COMPLETED"
        />
        <StatTile
          label="Post queue"
          value={queuedPosts.length}
          detail={
            overduePosts.length > 0
              ? `${overduePosts.length} overdue — post them!`
              : `${draftCount} draft${draftCount === 1 ? '' : 's'} waiting`
          }
          href="/social"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card
          title="Today"
          actions={
            <Link href="/jobs/new" className="text-sm font-medium text-cyan-700 hover:underline">
              + New job
            </Link>
          }
          padded={false}
        >
          {todayJobs.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Nothing on the schedule today"
                hint={
                  <Link href="/schedule" className="text-cyan-700 hover:underline">
                    Open the week view
                  </Link>
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {todayJobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50"
                  >
                    <span className="w-20 shrink-0 text-sm font-semibold tabular-nums text-slate-700">
                      {formatTime(job.scheduledAt, tz)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-900">
                        {job.customer.name} · {job.vehicle.make} {job.vehicle.model}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {job.items[0]?.name ?? 'No services'}
                        {job.items.length > 1 ? ` +${job.items.length - 1}` : ''} ·{' '}
                        {formatCents(jobTotalCents(job))}
                      </span>
                    </span>
                    <JobStatusBadge status={job.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card
            title="Social queue"
            actions={
              <Link
                href="/social/new"
                className="text-sm font-medium text-cyan-700 hover:underline"
              >
                + New post
              </Link>
            }
            padded={false}
          >
            {queuedPosts.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  title="Nothing scheduled"
                  hint="Finish a job, then “Create post” from its page."
                />
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {[...overduePosts, ...upcomingPosts].map((post) => {
                  const overdue = post.scheduledFor !== null && post.scheduledFor < now
                  const cover = post.photos[0]?.photo
                  return (
                    <li key={post.id} className="flex items-center gap-3 px-4 py-3">
                      {cover ? (
                        <img
                          src={`/api/photos/${cover.id}`}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded-lg object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                          —
                        </span>
                      )}
                      <Link href={`/social/${post.id}`} className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <PlatformChips platforms={post.platforms} />
                          {overdue ? (
                            <span className="text-xs font-semibold text-rose-600">
                              Overdue — was due{' '}
                              {post.scheduledFor && formatDateTime(post.scheduledFor, tz)}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500">
                              {post.scheduledFor
                                ? formatDateTime(post.scheduledFor, tz)
                                : 'Unscheduled'}
                            </span>
                          )}
                        </span>
                        <span className="mt-0.5 block truncate text-sm text-slate-700">
                          {post.caption.split('\n')[0] || 'No caption yet'}
                        </span>
                      </Link>
                      <form action={markPostedAction}>
                        <input type="hidden" name="id" value={post.id} />
                        <input type="hidden" name="back" value="/dashboard" />
                        <button type="submit" className={`${btnSecondary} ${btnSmall}`}>
                          Posted ✓
                        </button>
                      </form>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {(unpaid.length > 0 || photoGaps.length > 0) && (
            <Card title="Needs attention" padded={false}>
              <ul className="divide-y divide-slate-100">
                {unpaid.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50"
                    >
                      <span className="min-w-0 truncate text-sm text-slate-700">
                        <span className="font-medium text-slate-900">{job.customer.name}</span> —
                        completed {job.completedAt ? formatDate(job.completedAt, tz) : ''}
                      </span>
                      <span className="shrink-0 text-sm font-semibold text-amber-700">
                        {formatCents(jobTotalCents(job))} unpaid
                      </span>
                    </Link>
                  </li>
                ))}
                {photoGaps.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-slate-50"
                    >
                      <span className="min-w-0 truncate text-sm text-slate-700">
                        <span className="font-medium text-slate-900">
                          {job.vehicle.make} {job.vehicle.model}
                        </span>{' '}
                        ({job.customer.name}) has no photos
                      </span>
                      <span className="shrink-0 text-xs font-medium text-cyan-700">
                        add some → post it
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
