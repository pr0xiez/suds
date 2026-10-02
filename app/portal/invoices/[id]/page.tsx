import { ArrowLeftIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PrintButton } from '@/components/PrintButton'
import { Badge, btnSecondary } from '@/components/ui'
import { requirePortalUser } from '@/lib/bookingCustomer'
import { formatDateTime } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { formatCents, jobTotalCents } from '@/lib/money'

export default async function PortalInvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const user = await requirePortalUser(`/portal/invoices/${id}`)
  const job = await prisma.job.findFirst({
    where: { id, customer: { userId: user.id }, invoiceNumber: { not: null } },
    select: {
      invoiceNumber: true,
      scheduledAt: true,
      paidAt: true,
      tipCents: true,
      discountCents: true,
      locationAddress: true,
      customer: { select: { name: true } },
      vehicle: { select: { year: true, make: true, model: true } },
      items: { select: { id: true, name: true, priceCents: true }, orderBy: { sort: 'asc' } },
      business: {
        select: { name: true, settings: { select: { timezone: true, phone: true, email: true } } },
      },
    },
  })
  if (!job) notFound()
  return (
    <div data-portal-section="appointments">
      <div className="no-print mx-auto mb-6 flex max-w-2xl items-center justify-between gap-3">
        <Link
          href="/portal"
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeftIcon aria-hidden className="size-4" />
          Appointments
        </Link>
        <PrintButton className={btnSecondary} />
      </div>
      <article className="mx-auto max-w-2xl rounded-panel border border-line bg-surface p-6 shadow-panel sm:p-10 print:max-w-none print:rounded-none print:border-0 print:bg-transparent print:p-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold leading-tight text-ink">
              {job.business.name}
            </h1>
            <p className="mt-2 text-sm tabular-nums text-ink-muted">
              {job.business.settings?.phone}
            </p>
            <p className="break-all text-sm text-ink-muted">{job.business.settings?.email}</p>
          </div>
          <div className="sm:text-right">
            <h2 className="text-sm font-semibold text-ink">
              Invoice <span className="font-mono">#{job.invoiceNumber}</span>
            </h2>
            <p className="mt-2">
              <Badge tone={job.paidAt ? 'ok' : 'warn'}>{job.paidAt ? 'Paid' : 'Payment due'}</Badge>
            </p>
          </div>
        </header>
        <section className="mt-8 border-y border-line py-5">
          <p className="font-semibold text-ink">{job.customer.name}</p>
          <p className="mt-1 text-sm text-ink">
            {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
          </p>
          <p className="mt-1 text-sm tabular-nums text-ink-muted">
            {formatDateTime(job.scheduledAt, job.business.settings?.timezone ?? 'UTC')}
          </p>
          <p className="mt-1 break-words text-sm text-ink-muted">{job.locationAddress}</p>
        </section>
        <div className="mt-5 divide-y divide-line">
          {job.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-4 py-2.5 text-sm text-ink">
              <span className="min-w-0">{item.name}</span>
              <span className="shrink-0 tabular-nums">{formatCents(item.priceCents)}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 space-y-2 border-t border-line pt-5">
          {job.discountCents > 0 ? (
            <p className="flex justify-between text-sm text-ink-muted">
              <span>Discount</span>
              <span className="tabular-nums">−{formatCents(job.discountCents)}</span>
            </p>
          ) : null}
          {job.tipCents > 0 ? (
            <p className="flex justify-between text-sm text-ink-muted">
              <span>Tip</span>
              <span className="tabular-nums">{formatCents(job.tipCents)}</span>
            </p>
          ) : null}
          <p className="flex justify-between text-lg font-bold text-ink">
            <span>Total</span>
            <span className="tabular-nums">{formatCents(jobTotalCents(job) + job.tipCents)}</span>
          </p>
        </div>
        <p className="mt-8 text-xs leading-relaxed text-ink-muted">
          Please arrange payment directly with your detailer. Thank you for choosing{' '}
          {job.business.name}.
        </p>
      </article>
    </div>
  )
}
