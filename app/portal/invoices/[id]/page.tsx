import Link from 'next/link'
import { notFound } from 'next/navigation'
import { PrintButton } from '@/components/PrintButton'
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
    <div>
      <div className="no-print mb-5 flex items-center justify-between">
        <Link href="/portal" className="text-sm font-semibold">
          ← Appointments
        </Link>
        <PrintButton />
      </div>
      <article className="mx-auto max-w-2xl rounded-2xl border border-emerald-900/10 bg-white p-6 sm:p-10">
        <header className="flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{job.business.name}</h1>
            <p className="mt-2 text-sm text-slate-500">{job.business.settings?.phone}</p>
            <p className="text-sm text-slate-500">{job.business.settings?.email}</p>
          </div>
          <div>
            <h2 className="font-semibold">Invoice #{job.invoiceNumber}</h2>
            <p className="mt-2 text-sm">{job.paidAt ? 'Paid' : 'Payment due'}</p>
          </div>
        </header>
        <section className="mt-8 border-y border-emerald-900/10 py-5">
          <p className="font-semibold">{job.customer.name}</p>
          <p className="mt-1 text-sm">
            {job.vehicle.year} {job.vehicle.make} {job.vehicle.model}
          </p>
          <p className="mt-1 text-sm text-slate-500">
            {formatDateTime(job.scheduledAt, job.business.settings?.timezone ?? 'UTC')}
          </p>
          <p className="mt-1 text-sm text-slate-500">{job.locationAddress}</p>
        </section>
        <div className="mt-5 space-y-3">
          {job.items.map((item) => (
            <div key={item.id} className="flex justify-between gap-4 text-sm">
              <span>{item.name}</span>
              <span className="shrink-0">{formatCents(item.priceCents)}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 space-y-2 border-t border-emerald-900/10 pt-5">
          {job.discountCents > 0 ? (
            <p className="flex justify-between text-sm">
              <span>Discount</span>
              <span>−{formatCents(job.discountCents)}</span>
            </p>
          ) : null}
          {job.tipCents > 0 ? (
            <p className="flex justify-between text-sm">
              <span>Tip</span>
              <span>{formatCents(job.tipCents)}</span>
            </p>
          ) : null}
          <p className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>{formatCents(jobTotalCents(job) + job.tipCents)}</span>
          </p>
        </div>
        <p className="mt-8 text-xs text-slate-500">
          Please arrange payment directly with your detailer. Thank you for choosing{' '}
          {job.business.name}.
        </p>
      </article>
    </div>
  )
}
