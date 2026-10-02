import {
  ClipboardTextIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import Link from 'next/link'
import {
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  inputClass,
  JOB_STATUS_META,
  JobStatusBadge,
  PageHeader,
  segmentClass,
  segmentTrack,
  selectClass,
  tdClass,
  thClass,
} from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { dayBoundsUtc, formatDateTime, todayWall } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import type { Prisma } from '@/lib/generated/prisma/client'
import { formatCents, jobTotalCents } from '@/lib/money'
import { getSettings } from '@/lib/ops/settings'

export const metadata = { title: 'Jobs' }

const STATUSES = ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED', 'NO_SHOW'] as const
type StatusFilter = (typeof STATUSES)[number]
const WHENS = ['upcoming', 'past', 'all'] as const
type WhenFilter = (typeof WHENS)[number]

function query(params: { when: WhenFilter; status: string; q: string }): string {
  const search = new URLSearchParams()
  if (params.when !== 'upcoming') search.set('when', params.when)
  if (params.status) search.set('status', params.status)
  if (params.q) search.set('q', params.q)
  const s = search.toString()
  return s ? `?${s}` : ''
}

/** Paid, or what is missing in words: completed work awaiting payment stands out. */
function PaidCell({ paid, completed }: { paid: boolean; completed: boolean }) {
  if (paid) return <span className="text-xs font-medium text-ok">Paid</span>
  return (
    <span className={clsx('text-xs', completed ? 'font-medium text-warn' : 'text-ink-faint')}>
      Unpaid
    </span>
  )
}

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ when?: string; status?: string; q?: string }>
}) {
  const user = await requireUser()
  const settings = await getSettings(user.businessId)
  const tz = settings.timezone
  const params = await searchParams
  const when: WhenFilter = WHENS.includes(params.when as WhenFilter)
    ? (params.when as WhenFilter)
    : 'upcoming'
  const status = STATUSES.includes(params.status as StatusFilter) ? (params.status ?? '') : ''
  const q = (params.q ?? '').trim()

  const { start: todayStart } = dayBoundsUtc(todayWall(tz), tz)
  const where: Prisma.JobWhereInput = {}
  if (when === 'upcoming') where.scheduledAt = { gte: todayStart }
  if (when === 'past') where.scheduledAt = { lt: todayStart }
  if (status) where.status = status as StatusFilter
  if (q) {
    where.OR = [
      { customer: { name: { contains: q, mode: 'insensitive' } } },
      { vehicle: { make: { contains: q, mode: 'insensitive' } } },
      { vehicle: { model: { contains: q, mode: 'insensitive' } } },
      { vehicle: { plate: { contains: q, mode: 'insensitive' } } },
    ]
  }

  const jobs = await prisma.job.findMany({
    where: { ...where, businessId: user.businessId },
    include: { customer: true, vehicle: true, items: true },
    orderBy: { scheduledAt: when === 'past' ? 'desc' : 'asc' },
    take: 200,
  })

  return (
    <div>
      <PageHeader
        title="Jobs"
        actions={
          <Link href="/jobs/new" className={btnPrimary}>
            <PlusIcon aria-hidden />
            New job
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <nav aria-label="When" className={clsx(segmentTrack, 'self-start')}>
          {WHENS.map((option) => (
            <Link
              key={option}
              href={`/jobs${query({ when: option, status, q })}`}
              aria-current={when === option ? 'page' : undefined}
              className={clsx(segmentClass(when === option), 'capitalize')}
            >
              {option}
            </Link>
          ))}
        </nav>
        <form
          method="get"
          action="/jobs"
          className="grid min-w-0 flex-1 grid-cols-1 gap-2 sm:grid-cols-[11rem_minmax(0,1fr)_auto] lg:max-w-2xl"
        >
          {when !== 'upcoming' ? <input type="hidden" name="when" value={when} /> : null}
          <select name="status" defaultValue={status} aria-label="Status" className={selectClass}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {JOB_STATUS_META[s].label}
              </option>
            ))}
          </select>
          <div className="relative min-w-0">
            <MagnifyingGlassIcon
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-faint"
            />
            <input
              name="q"
              defaultValue={q}
              aria-label="Search jobs"
              placeholder="Search customer, vehicle, plate…"
              className={clsx(inputClass, 'pl-9')}
            />
          </div>
          <button type="submit" className={btnSecondary}>
            <FunnelSimpleIcon aria-hidden />
            Filter
          </button>
        </form>
      </div>

      <Card padded={false} className="overflow-hidden">
        {jobs.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon={ClipboardTextIcon}
              title="No jobs match"
              hint="Try different filters, or book one."
              action={
                <Link href="/jobs/new" className={btnSecondary}>
                  <PlusIcon aria-hidden />
                  New job
                </Link>
              }
            />
          </div>
        ) : (
          <>
            {/* Phones: one tappable row per job */}
            <ul className="divide-y divide-line sm:hidden">
              {jobs.map((job) => (
                <li key={job.id}>
                  <Link
                    href={`/jobs/${job.id}`}
                    className="flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium tabular-nums text-ink-muted">
                        {formatDateTime(job.scheduledAt, tz)}
                      </span>
                      <span className="mt-1 block truncate text-sm font-medium text-ink">
                        {job.customer.name}
                        <span className="font-normal text-ink-muted">
                          {' '}
                          {job.vehicle.make} {job.vehicle.model}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-ink-muted">
                        {job.items[0]?.name ?? 'No services'}
                        {job.items.length > 1 ? ` +${job.items.length - 1}` : ''}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <span className="text-sm font-semibold tabular-nums text-ink">
                        {formatCents(jobTotalCents(job))}
                      </span>
                      <JobStatusBadge status={job.status} />
                      {job.paidAt || job.status === 'COMPLETED' ? (
                        <PaidCell
                          paid={Boolean(job.paidAt)}
                          completed={job.status === 'COMPLETED'}
                        />
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th className={thClass}>When</th>
                    <th className={thClass}>Customer</th>
                    <th className={thClass}>Vehicle</th>
                    <th className={thClass}>Services</th>
                    <th className={clsx(thClass, 'text-right')}>Total</th>
                    <th className={thClass}>Status</th>
                    <th className={thClass}>Paid</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {jobs.map((job) => (
                    <tr key={job.id} className="relative transition-colors hover:bg-surface-2">
                      <td className={clsx(tdClass, 'whitespace-nowrap tabular-nums text-ink')}>
                        <Link href={`/jobs/${job.id}`} className="after:absolute after:inset-0">
                          {formatDateTime(job.scheduledAt, tz)}
                        </Link>
                      </td>
                      <td className={clsx(tdClass, 'font-medium text-ink')}>{job.customer.name}</td>
                      <td className={clsx(tdClass, 'text-ink-muted')}>
                        {job.vehicle.year ? `${job.vehicle.year} ` : ''}
                        {job.vehicle.make} {job.vehicle.model}
                      </td>
                      <td className={clsx(tdClass, 'max-w-52 truncate text-ink-muted')}>
                        {job.items[0]?.name ?? 'No services'}
                        {job.items.length > 1 ? ` +${job.items.length - 1}` : ''}
                      </td>
                      <td
                        className={clsx(tdClass, 'text-right font-semibold tabular-nums text-ink')}
                      >
                        {formatCents(jobTotalCents(job))}
                      </td>
                      <td className={tdClass}>
                        <JobStatusBadge status={job.status} />
                      </td>
                      <td className={tdClass}>
                        <PaidCell
                          paid={Boolean(job.paidAt)}
                          completed={job.status === 'COMPLETED'}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
