import clsx from 'clsx'
import Link from 'next/link'
import {
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  inputClass,
  JobStatusBadge,
  PageHeader,
  selectClass,
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
            + New job
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5">
          {WHENS.map((option) => (
            <Link
              key={option}
              href={`/jobs${query({ when: option, status, q })}`}
              className={clsx(
                'rounded-md px-3 py-1.5 text-sm font-medium capitalize',
                when === option ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {option}
            </Link>
          ))}
        </div>
        <form method="get" action="/jobs" className="flex flex-1 flex-wrap items-center gap-2">
          {when !== 'upcoming' ? <input type="hidden" name="when" value={when} /> : null}
          <select name="status" defaultValue={status} className={`${selectClass} w-40`}>
            <option value="">Any status</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
          <input
            name="q"
            defaultValue={q}
            placeholder="Search customer, vehicle, plate…"
            className={`${inputClass} max-w-xs`}
          />
          <button type="submit" className={btnSecondary}>
            Filter
          </button>
        </form>
      </div>

      <Card padded={false}>
        {jobs.length === 0 ? (
          <div className="p-4">
            <EmptyState title="No jobs match" hint="Try different filters, or book one." />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5">When</th>
                  <th className="px-4 py-2.5">Customer</th>
                  <th className="px-4 py-2.5">Vehicle</th>
                  <th className="px-4 py-2.5">Services</th>
                  <th className="px-4 py-2.5 text-right">Total</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <tr key={job.id} className="relative hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                      <Link href={`/jobs/${job.id}`} className="after:absolute after:inset-0">
                        {formatDateTime(job.scheduledAt, tz)}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{job.customer.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">
                      {job.vehicle.year ? `${job.vehicle.year} ` : ''}
                      {job.vehicle.make} {job.vehicle.model}
                    </td>
                    <td className="max-w-52 truncate px-4 py-2.5 text-slate-600">
                      {job.items[0]?.name ?? '—'}
                      {job.items.length > 1 ? ` +${job.items.length - 1}` : ''}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                      {formatCents(jobTotalCents(job))}
                    </td>
                    <td className="px-4 py-2.5">
                      <JobStatusBadge status={job.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      {job.paidAt ? (
                        <span className="text-xs font-semibold text-emerald-700">Paid</span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
