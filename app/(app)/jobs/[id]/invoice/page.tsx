import { ArrowLeftIcon, CheckCircleIcon, ClockIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PrintButton } from '@/components/PrintButton'
import { btnPrimary } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { describeVehicle } from '@/lib/captions'
import { formatDateTime, formatFullDate } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { formatCents, jobTotalCents, sumCents } from '@/lib/money'
import { getSettings } from '@/lib/ops/settings'

export const metadata = { title: 'Invoice' }

const metaLabel = 'text-xs font-medium text-ink-muted'

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser()
  const { id } = await params
  const [settings, job] = await Promise.all([
    getSettings(user.businessId),
    prisma.job.findUnique({
      where: { businessId: user.businessId, id },
      include: { customer: true, vehicle: true, items: { orderBy: { sort: 'asc' } } },
    }),
  ])
  if (!job) notFound()
  if (job.invoiceNumber === null) redirect(`/jobs/${id}`)

  const tz = settings.timezone
  const subtotal = sumCents(job.items)
  // Same total as the customer's portal copy of this invoice: the tip rides on top.
  const total = jobTotalCents(job) + job.tipCents

  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-6 flex items-center justify-between gap-3">
        <Link
          href={`/jobs/${job.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeftIcon aria-hidden className="size-4" />
          Back to job
        </Link>
        <PrintButton className={btnPrimary} />
      </div>

      <article className="rounded-panel border border-line bg-surface p-6 shadow-panel sm:p-10 print:rounded-none print:border-0 print:bg-transparent print:p-0 print:shadow-none">
        <header className="flex flex-col gap-6 border-b border-line pb-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="font-display text-xl font-bold leading-tight text-ink">
              {settings.businessName}
            </p>
            <div className="mt-2 space-y-0.5 text-sm text-ink-muted">
              {settings.address ? <p>{settings.address}</p> : null}
              {settings.city ? <p>{settings.city}</p> : null}
              {settings.phone ? <p className="tabular-nums">{settings.phone}</p> : null}
              {settings.email ? <p className="break-all">{settings.email}</p> : null}
            </div>
          </div>
          <div className="shrink-0 sm:text-right">
            <h1 className="font-display text-3xl font-bold leading-none text-ink">Invoice</h1>
            <p className="mt-3 font-mono text-sm text-ink">#{job.invoiceNumber}</p>
            {job.invoicedAt ? (
              <p className="mt-1 text-sm text-ink-muted">
                Issued {formatFullDate(job.invoicedAt, tz)}
              </p>
            ) : null}
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 py-8 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <p className={metaLabel}>Bill to</p>
            <p className="mt-1.5 font-medium text-ink">{job.customer.name}</p>
            {job.customer.address ? <p className="text-ink-muted">{job.customer.address}</p> : null}
            {job.customer.phone ? (
              <p className="tabular-nums text-ink-muted">{job.customer.phone}</p>
            ) : null}
            {job.customer.email ? (
              <p className="break-all text-ink-muted">{job.customer.email}</p>
            ) : null}
          </div>
          <div className="min-w-0">
            <p className={metaLabel}>Service</p>
            <p className="mt-1.5 font-medium text-ink">{describeVehicle(job.vehicle)}</p>
            {job.vehicle.plate ? (
              <p className="text-ink-muted">
                Plate <span className="font-mono text-ink">{job.vehicle.plate}</span>
              </p>
            ) : null}
            <p className="tabular-nums text-ink-muted">{formatDateTime(job.scheduledAt, tz)}</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line-strong">
              <th className={`${metaLabel} py-2.5 text-left`}>Item</th>
              <th className={`${metaLabel} py-2.5 text-right`}>Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {job.items.map((item) => (
              <tr key={item.id}>
                <td className="py-3 pr-4 text-ink">{item.name}</td>
                <td className="py-3 text-right tabular-nums text-ink">
                  {formatCents(item.priceCents)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {job.discountCents > 0 || job.tipCents > 0 ? (
              <tr className="border-t border-line">
                <td className="pt-3 text-ink-muted">Subtotal</td>
                <td className="pt-3 text-right tabular-nums text-ink">{formatCents(subtotal)}</td>
              </tr>
            ) : null}
            {job.discountCents > 0 ? (
              <tr>
                <td className="py-1.5 text-ink-muted">Discount</td>
                <td className="py-1.5 text-right tabular-nums text-ink-muted">
                  −{formatCents(job.discountCents)}
                </td>
              </tr>
            ) : null}
            {job.tipCents > 0 ? (
              <tr>
                <td className="py-1.5 text-ink-muted">Tip</td>
                <td className="py-1.5 text-right tabular-nums text-ink-muted">
                  {formatCents(job.tipCents)}
                </td>
              </tr>
            ) : null}
            <tr className="border-t-2 border-ink">
              <td className="pt-3 text-base font-semibold text-ink">Total</td>
              <td className="pt-3 text-right font-display text-xl font-bold tabular-nums text-ink">
                {formatCents(total)}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-6">
          {job.paidAt ? (
            <p className="inline-flex items-center gap-2 rounded-control border border-ok-line bg-ok-soft px-3 py-1.5 text-sm font-semibold text-ok">
              <CheckCircleIcon aria-hidden className="size-4" />
              Paid · {formatFullDate(job.paidAt, tz)}
            </p>
          ) : (
            <p className="inline-flex items-center gap-2 rounded-control border border-warn-line bg-warn-soft px-3 py-1.5 text-sm font-semibold text-warn">
              <ClockIcon aria-hidden className="size-4" />
              Balance due
            </p>
          )}
        </div>

        {job.notes ? (
          <div className="mt-8 text-sm">
            <p className={metaLabel}>Notes</p>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-ink">{job.notes}</p>
          </div>
        ) : null}

        <footer className="mt-10 border-t border-line pt-5 text-center text-xs text-ink-muted">
          <p>Thank you for your business!</p>
          {settings.instagramHandle ? <p className="mt-1">@{settings.instagramHandle}</p> : null}
        </footer>
      </article>
    </div>
  )
}
