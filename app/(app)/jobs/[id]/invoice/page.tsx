import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { PrintButton } from '@/components/PrintButton'
import { btnPrimary, btnSecondary } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { describeVehicle } from '@/lib/captions'
import { formatDateTime, formatFullDate } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { formatCents, jobTotalCents, sumCents } from '@/lib/money'
import { getSettings } from '@/lib/ops/settings'

export const metadata = { title: 'Invoice' }

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser()
  const { id } = await params
  const [settings, job] = await Promise.all([
    getSettings(),
    prisma.job.findUnique({
      where: { id },
      include: { customer: true, vehicle: true, items: { orderBy: { sort: 'asc' } } },
    }),
  ])
  if (!job) notFound()
  if (job.invoiceNumber === null) redirect(`/jobs/${id}`)

  const tz = settings.timezone
  const subtotal = sumCents(job.items)
  const total = jobTotalCents(job)

  return (
    <div className="mx-auto max-w-2xl">
      <div className="no-print mb-4 flex items-center justify-between">
        <Link href={`/jobs/${job.id}`} className={btnSecondary}>
          ← Back to job
        </Link>
        <PrintButton className={btnPrimary} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm print:rounded-none print:border-0 print:p-0 print:shadow-none">
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              {settings.businessName}
            </h1>
            <div className="mt-1 text-sm text-slate-500">
              {settings.address ? <p>{settings.address}</p> : null}
              {settings.city ? <p>{settings.city}</p> : null}
              {settings.phone ? <p>{settings.phone}</p> : null}
              {settings.email ? <p>{settings.email}</p> : null}
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-slate-900">Invoice</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">#{job.invoiceNumber}</p>
            {job.invoicedAt ? (
              <p className="text-sm text-slate-500">Issued {formatFullDate(job.invoicedAt, tz)}</p>
            ) : null}
          </div>
        </header>

        <div className="grid grid-cols-2 gap-6 py-6 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Bill to</p>
            <p className="mt-1 font-medium text-slate-900">{job.customer.name}</p>
            {job.customer.address ? <p className="text-slate-500">{job.customer.address}</p> : null}
            {job.customer.phone ? <p className="text-slate-500">{job.customer.phone}</p> : null}
            {job.customer.email ? <p className="text-slate-500">{job.customer.email}</p> : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Service</p>
            <p className="mt-1 font-medium text-slate-900">{describeVehicle(job.vehicle)}</p>
            {job.vehicle.plate ? <p className="text-slate-500">Plate {job.vehicle.plate}</p> : null}
            <p className="text-slate-500">{formatDateTime(job.scheduledAt, tz)}</p>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-300 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              <th className="py-2">Item</th>
              <th className="py-2 text-right">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {job.items.map((item) => (
              <tr key={item.id}>
                <td className="py-2.5 text-slate-800">{item.name}</td>
                <td className="py-2.5 text-right tabular-nums">{formatCents(item.priceCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            {job.discountCents > 0 ? (
              <>
                <tr className="border-t border-slate-200">
                  <td className="pt-2.5 text-slate-500">Subtotal</td>
                  <td className="pt-2.5 text-right tabular-nums">{formatCents(subtotal)}</td>
                </tr>
                <tr>
                  <td className="py-1 text-slate-500">Discount</td>
                  <td className="py-1 text-right tabular-nums">
                    −{formatCents(job.discountCents)}
                  </td>
                </tr>
              </>
            ) : null}
            <tr className="border-t-2 border-slate-800">
              <td className="py-2.5 text-base font-bold text-slate-900">Total</td>
              <td className="py-2.5 text-right text-base font-bold tabular-nums text-slate-900">
                {formatCents(total)}
              </td>
            </tr>
          </tfoot>
        </table>

        <div className="mt-4">
          {job.paidAt ? (
            <p className="inline-block rounded-lg border-2 border-emerald-600 px-3 py-1 text-sm font-bold uppercase tracking-wide text-emerald-700">
              Paid · {formatFullDate(job.paidAt, tz)}
            </p>
          ) : (
            <p className="inline-block rounded-lg border-2 border-amber-500 px-3 py-1 text-sm font-bold uppercase tracking-wide text-amber-600">
              Balance due
            </p>
          )}
        </div>

        {job.notes ? (
          <div className="mt-6 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
            <p className="mt-1 whitespace-pre-wrap text-slate-600">{job.notes}</p>
          </div>
        ) : null}

        <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
          <p>Thank you for your business!</p>
          {settings.instagramHandle ? <p className="mt-1">@{settings.instagramHandle}</p> : null}
        </footer>
      </div>
    </div>
  )
}
