import {
  ArrowRightIcon,
  CalendarBlankIcon,
  CalendarPlusIcon,
  CameraIcon,
  CheckIcon,
  HandWavingIcon,
  ImageIcon,
  MegaphoneIcon,
  PlusIcon,
  StorefrontIcon,
  TrayIcon,
} from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { markPostedAction } from '@/app/actions/social'
import {
  btnPrimary,
  btnSecondary,
  btnSmall,
  Callout,
  Card,
  EmptyState,
  JobStatusBadge,
  linkClass,
  PageHeader,
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
  const user = await requireUser()
  const settings = await getSettings(user.businessId)
  const tz = settings.timezone
  const now = new Date()
  const today = todayWall(tz, now)
  const { start: dayStart, end: dayEnd } = dayBoundsUtc(today, tz)
  const monthStart = wallTimeToUtc({ ...today, day: 1, hour: 0, minute: 0 }, tz)
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const [
    todayJobs,
    paidThisMonth,
    unpaid,
    queuedPosts,
    draftCount,
    photoGaps,
    business,
    requestCount,
  ] = await Promise.all([
    prisma.job.findMany({
      where: { businessId: user.businessId, scheduledAt: { gte: dayStart, lt: dayEnd } },
      include: { customer: true, vehicle: true, items: true },
      orderBy: { scheduledAt: 'asc' },
    }),
    prisma.job.findMany({
      where: { businessId: user.businessId, paidAt: { gte: monthStart } },
      include: { items: true },
    }),
    prisma.job.findMany({
      where: { businessId: user.businessId, status: 'COMPLETED', paidAt: null },
      include: { customer: true, items: true },
      orderBy: { completedAt: 'desc' },
      take: 8,
    }),
    prisma.socialPost.findMany({
      where: { businessId: user.businessId, status: 'SCHEDULED' },
      include: { photos: { include: { photo: true }, orderBy: { sort: 'asc' } } },
      orderBy: { scheduledFor: 'asc' },
      take: 10,
    }),
    prisma.socialPost.count({ where: { businessId: user.businessId, status: 'DRAFT' } }),
    prisma.job.findMany({
      where: {
        businessId: user.businessId,
        status: 'COMPLETED',
        completedAt: { gte: weekAgo },
        photos: { none: {} },
      },
      include: { customer: true, vehicle: true },
      orderBy: { completedAt: 'desc' },
      take: 5,
    }),
    prisma.business.findUniqueOrThrow({ where: { id: user.businessId } }),
    prisma.booking.count({ where: { businessId: user.businessId, status: 'PENDING' } }),
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

  const isOwner = user.businessRole === 'OWNER'

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={formatFullDate(now, tz)}
        actions={
          <Link href="/jobs/new" className={btnPrimary}>
            <PlusIcon aria-hidden />
            New job
          </Link>
        }
      />

      <div className="mb-6 space-y-3 empty:hidden">
        {isOwner && (!settings.setupComplete || business.status !== 'PUBLISHED') && (
          <Callout
            tone="accent"
            icon={StorefrontIcon}
            title="Get ready for your first booking"
            action={
              <Link href="/onboarding" className={btnPrimary}>
                Continue business setup
                <ArrowRightIcon aria-hidden />
              </Link>
            }
          >
            Set up your services, hours, and service area, then publish your booking page.
          </Callout>
        )}
        {requestCount > 0 && (
          <Callout
            tone="warn"
            icon={TrayIcon}
            title={`${requestCount} booking request${requestCount === 1 ? '' : 's'} waiting for a decision`}
            action={
              <Link href="/bookings" className={btnSecondary}>
                Review requests
              </Link>
            }
          />
        )}
      </div>

      <section
        aria-label="This month at a glance"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-panel border border-line bg-line shadow-panel lg:grid-cols-4"
      >
        <StatTile
          className="bg-surface"
          label="Today's jobs"
          value={activeToday.length}
          detail={activeToday.length > 0 ? `${formatCents(todayValue)} on the books` : 'Open day'}
          href="/schedule"
        />
        <StatTile
          className="bg-surface"
          label="Collected this month"
          value={formatCents(monthRevenue)}
          detail={`${paidThisMonth.length} paid job${paidThisMonth.length === 1 ? '' : 's'}`}
          href="/jobs?when=past"
        />
        <StatTile
          className="bg-surface"
          label="Awaiting payment"
          value={formatCents(unpaidTotal)}
          detail={`${unpaid.length} completed job${unpaid.length === 1 ? '' : 's'}`}
          href="/jobs?status=COMPLETED"
        />
        <StatTile
          className="bg-surface"
          label="Post queue"
          value={queuedPosts.length}
          detail={
            overduePosts.length > 0 ? (
              <span className="font-medium text-danger">{overduePosts.length} overdue</span>
            ) : (
              `${draftCount} draft${draftCount === 1 ? '' : 's'} waiting`
            )
          }
          href="/social"
        />
      </section>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card
          className="lg:self-start"
          title="Today"
          actions={
            <Link href="/schedule" className={`${linkClass} text-sm`}>
              Week view
            </Link>
          }
          padded={false}
        >
          {todayJobs.length === 0 ? (
            <div className="p-4 sm:p-5">
              <EmptyState
                icon={CalendarBlankIcon}
                title="Nothing on the schedule today"
                hint="Book a job, or share your booking page to fill the day."
              />
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {todayJobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5"
                  >
                    <span className="w-16 shrink-0 text-sm font-semibold tabular-nums text-ink">
                      {formatTime(job.scheduledAt, tz)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-ink">
                        {job.customer.name}
                        <span className="font-normal text-ink-muted">
                          {' '}
                          {job.vehicle.make} {job.vehicle.model}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        {job.items[0]?.name ?? 'No services'}
                        {job.items.length > 1 ? ` +${job.items.length - 1}` : ''},{' '}
                        <span className="tabular-nums">{formatCents(jobTotalCents(job))}</span>
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
                className={`${linkClass} inline-flex items-center gap-1 text-sm`}
              >
                <PlusIcon aria-hidden className="size-3.5" />
                New post
              </Link>
            }
            padded={false}
          >
            {queuedPosts.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  icon={MegaphoneIcon}
                  title="Nothing scheduled"
                  hint="Finish a job, then choose Create post from its page."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {[...overduePosts, ...upcomingPosts].map((post) => {
                  const overdue = post.scheduledFor !== null && post.scheduledFor < now
                  const cover = post.photos[0]?.photo
                  return (
                    <li key={post.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                      {cover ? (
                        <img
                          src={`/api/photos/${cover.id}`}
                          alt=""
                          className="size-11 shrink-0 rounded-control object-cover"
                        />
                      ) : (
                        <span className="grid size-11 shrink-0 place-items-center rounded-control bg-surface-2 text-ink-faint">
                          <ImageIcon aria-hidden className="size-5" />
                        </span>
                      )}
                      <Link href={`/social/${post.id}`} className="group min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-2">
                          <PlatformChips platforms={post.platforms} />
                          {overdue ? (
                            <span className="text-xs font-medium text-danger">
                              Was due {post.scheduledFor && formatDateTime(post.scheduledFor, tz)}
                            </span>
                          ) : (
                            <span className="text-xs text-ink-muted">
                              {post.scheduledFor
                                ? formatDateTime(post.scheduledFor, tz)
                                : 'Unscheduled'}
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block truncate text-sm text-ink group-hover:underline">
                          {post.caption.split('\n')[0] || 'No caption yet'}
                        </span>
                      </Link>
                      <form action={markPostedAction}>
                        <input type="hidden" name="id" value={post.id} />
                        <input type="hidden" name="back" value="/dashboard" />
                        <button type="submit" className={`${btnSecondary} ${btnSmall}`}>
                          <CheckIcon aria-hidden />
                          Posted
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
              <ul className="divide-y divide-line">
                {unpaid.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5"
                    >
                      <span className="min-w-0 truncate text-sm text-ink-muted">
                        <span className="font-medium text-ink">{job.customer.name}</span>, completed{' '}
                        {job.completedAt ? formatDate(job.completedAt, tz) : ''}
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums text-warn">
                        {formatCents(jobTotalCents(job))} unpaid
                      </span>
                    </Link>
                  </li>
                ))}
                {photoGaps.map((job) => (
                  <li key={job.id}>
                    <Link
                      href={`/jobs/${job.id}`}
                      className="flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5"
                    >
                      <span className="min-w-0 truncate text-sm text-ink-muted">
                        <span className="font-medium text-ink">
                          {job.vehicle.make} {job.vehicle.model}
                        </span>{' '}
                        ({job.customer.name}) has no photos
                      </span>
                      <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent-ink">
                        <CameraIcon aria-hidden className="size-3.5" />
                        Add photos
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {isOwner && (
        <section className="mt-10">
          <h2 className="font-display text-lg font-bold text-ink">Grow your business</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Choose a marketing task and prepare a campaign with the Suds assistant.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/marketing?task=job" className={btnSecondary}>
              <CameraIcon aria-hidden />
              Show a finished job
            </Link>
            <Link href="/marketing?task=slots" className={btnSecondary}>
              <CalendarPlusIcon aria-hidden />
              Fill an open appointment
            </Link>
            <Link href="/marketing?task=intro" className={btnSecondary}>
              <HandWavingIcon aria-hidden />
              Introduce your business
            </Link>
          </div>
        </section>
      )}
    </div>
  )
}
