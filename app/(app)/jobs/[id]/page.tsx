import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  clearPaymentAction,
  createPostFromJobAction,
  deleteJobAction,
  generateInvoiceAction,
  recordPaymentAction,
  setJobStatusAction,
} from '@/app/actions/jobs'
import { ErrorBanner, SuccessBanner } from '@/components/banners'
import { ConfirmSubmit } from '@/components/ConfirmSubmit'
import { CopyButton } from '@/components/CopyButton'
import { MediaUploader } from '@/components/MediaUploader'
import { PhotoTile } from '@/components/PhotoTile'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSmall,
  Card,
  EmptyState,
  Field,
  inputClass,
  JobStatusBadge,
  PostStatusBadge,
  selectClass,
} from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { describeVehicle } from '@/lib/captions'
import { formatDateTime, minutesToHuman } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import type { JobStatus } from '@/lib/generated/prisma/enums'
import { formatCents, jobTotalCents, sumCents } from '@/lib/money'
import { availableTransitions } from '@/lib/ops/jobs'
import { getSettings } from '@/lib/ops/settings'
import { durableStorageConfigured } from '@/lib/storage'

export const metadata = { title: 'Job' }

const TRANSITION_META: Record<JobStatus, { label: string; className: string; confirm?: string }> = {
  IN_PROGRESS: { label: '▶ Start', className: btnPrimary },
  COMPLETED: { label: '✓ Complete', className: btnPrimary },
  SCHEDULED: { label: 'Reopen', className: btnSecondary, confirm: 'Reopen this job?' },
  CANCELED: { label: 'Cancel job', className: btnDanger, confirm: 'Cancel this job?' },
  NO_SHOW: { label: 'No-show', className: btnDanger, confirm: 'Mark as a no-show?' },
}
const TRANSITION_ORDER: JobStatus[] = [
  'IN_PROGRESS',
  'COMPLETED',
  'SCHEDULED',
  'CANCELED',
  'NO_SHOW',
]

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  VENMO: 'Venmo',
  CASHAPP: 'Cash App',
  ZELLE: 'Zelle',
  OTHER: 'Other',
}

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; saved?: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  const { error, saved } = await searchParams
  const [settings, job] = await Promise.all([
    getSettings(user.businessId),
    prisma.job.findUnique({
      where: { businessId: user.businessId, id },
      include: {
        customer: true,
        vehicle: true,
        items: { orderBy: { sort: 'asc' } },
        photos: { orderBy: { createdAt: 'asc' } },
        posts: { orderBy: { createdAt: 'desc' } },
      },
    }),
  ])
  if (!job) notFound()

  const tz = settings.timezone
  const subtotal = sumCents(job.items)
  const total = jobTotalCents(job)
  const transitions = TRANSITION_ORDER.filter((t) => availableTransitions(job.status).includes(t))
  const backPath = `/jobs/${job.id}`

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{job.customer.name}</h1>
            <JobStatusBadge status={job.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {describeVehicle(job.vehicle)}
            {job.vehicle.plate ? ` · ${job.vehicle.plate}` : ''} ·{' '}
            {formatDateTime(job.scheduledAt, tz)} · {minutesToHuman(job.durationMin)}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {transitions.map((target) => {
            const meta = TRANSITION_META[target]
            return (
              <form key={target} action={setJobStatusAction}>
                <input type="hidden" name="id" value={job.id} />
                <input type="hidden" name="status" value={target} />
                <input type="hidden" name="back" value={backPath} />
                {meta.confirm ? (
                  <ConfirmSubmit message={meta.confirm} className={meta.className}>
                    {meta.label}
                  </ConfirmSubmit>
                ) : (
                  <button type="submit" className={meta.className}>
                    {meta.label}
                  </button>
                )}
              </form>
            )
          })}
          <Link href={`/jobs/${job.id}/edit`} className={btnSecondary}>
            Edit
          </Link>
          <form action={deleteJobAction}>
            <input type="hidden" name="id" value={job.id} />
            <ConfirmSubmit
              message="Delete this job, its photos, and its files? This can't be undone."
              className={btnDanger}
            >
              Delete
            </ConfirmSubmit>
          </form>
        </div>
      </div>

      <ErrorBanner message={error} />
      <SuccessBanner message={saved ? 'Saved.' : null} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card title="Line items" padded={false}>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-slate-100">
                {job.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium text-slate-900">{item.name}</span>
                      <span className="ml-2 text-xs text-slate-400">
                        {minutesToHuman(item.durationMin)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatCents(item.priceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-200 text-sm">
                {job.discountCents > 0 ? (
                  <>
                    <tr>
                      <td className="px-4 pt-2.5 text-slate-500">Subtotal</td>
                      <td className="px-4 pt-2.5 text-right tabular-nums">
                        {formatCents(subtotal)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-1 text-slate-500">Discount</td>
                      <td className="px-4 py-1 text-right tabular-nums text-rose-600">
                        −{formatCents(job.discountCents)}
                      </td>
                    </tr>
                  </>
                ) : null}
                <tr>
                  <td className="px-4 py-2.5 font-semibold">Total</td>
                  <td className="px-4 py-2.5 text-right font-bold tabular-nums">
                    {formatCents(total)}
                  </td>
                </tr>
                {job.tipCents > 0 ? (
                  <tr>
                    <td className="px-4 pb-2.5 text-slate-500">Tip</td>
                    <td className="px-4 pb-2.5 text-right tabular-nums text-emerald-700">
                      +{formatCents(job.tipCents)}
                    </td>
                  </tr>
                ) : null}
              </tfoot>
            </table>
          </Card>

          <Card
            title={`Photos (${job.photos.length})`}
            actions={
              <span className="text-xs text-slate-400">before / after fuels the social side</span>
            }
          >
            {durableStorageConfigured() ? (
              <MediaUploader jobId={job.id} />
            ) : (
              <form
                method="post"
                action={`/api/jobs/${job.id}/photos`}
                encType="multipart/form-data"
                className="mb-4 flex flex-wrap items-center gap-2"
              >
                <select name="kind" className={`${selectClass} w-28`} defaultValue="BEFORE">
                  <option value="BEFORE">Before</option>
                  <option value="AFTER">After</option>
                  <option value="OTHER">Other</option>
                </select>
                <input
                  type="file"
                  name="files"
                  accept="image/*"
                  multiple
                  required
                  className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-200 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-300"
                />
                <button type="submit" className={btnSecondary}>
                  Upload
                </button>
              </form>
            )}
            {job.photos.length === 0 ? (
              <EmptyState
                title="No photos yet"
                hint="Snap befores when the car arrives and afters before it leaves."
              />
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
                {job.photos.map((photo) => (
                  <PhotoTile
                    key={photo.id}
                    photo={photo}
                    back={backPath}
                    canApprove={user.businessRole === 'OWNER'}
                  />
                ))}
              </div>
            )}
          </Card>

          {job.notes || job.internalNotes ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {job.notes ? (
                <Card title="Job notes">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{job.notes}</p>
                </Card>
              ) : null}
              {job.internalNotes ? (
                <Card title="Internal notes">
                  <p className="whitespace-pre-wrap text-sm text-slate-700">{job.internalNotes}</p>
                </Card>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card title="Payment">
            {job.paidAt ? (
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-emerald-700">
                  Paid {formatCents(total + job.tipCents)}
                  {job.tipCents > 0 ? ` (incl. ${formatCents(job.tipCents)} tip)` : ''}
                </p>
                <p className="text-slate-500">
                  {PAYMENT_LABELS[job.paymentMethod ?? 'OTHER']} · {formatDateTime(job.paidAt, tz)}
                </p>
                <form action={clearPaymentAction}>
                  <input type="hidden" name="id" value={job.id} />
                  <ConfirmSubmit
                    message="Clear this payment record?"
                    className={`${btnSecondary} ${btnSmall}`}
                  >
                    Clear payment
                  </ConfirmSubmit>
                </form>
              </div>
            ) : (
              <form action={recordPaymentAction} className="space-y-3">
                <input type="hidden" name="id" value={job.id} />
                <Field label="Method">
                  <select name="method" className={selectClass} defaultValue="CASH">
                    {Object.entries(PAYMENT_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Tip (optional)">
                  <input name="tip" placeholder="0" className={inputClass} />
                </Field>
                <button type="submit" className={`${btnPrimary} w-full`}>
                  Mark paid · {formatCents(total)}
                </button>
              </form>
            )}
          </Card>

          <Card title="Invoice">
            {job.invoiceNumber !== null ? (
              <div className="space-y-2 text-sm">
                <p className="font-semibold text-slate-900">Invoice #{job.invoiceNumber}</p>
                {job.invoicedAt ? (
                  <p className="text-slate-500">Issued {formatDateTime(job.invoicedAt, tz)}</p>
                ) : null}
                <Link href={`/jobs/${job.id}/invoice`} className={`${btnSecondary} ${btnSmall}`}>
                  View / print
                </Link>
              </div>
            ) : (
              <form action={generateInvoiceAction}>
                <input type="hidden" name="id" value={job.id} />
                <button type="submit" className={`${btnSecondary} w-full`}>
                  Generate invoice
                </button>
              </form>
            )}
          </Card>

          <Card title="Social">
            <div className="space-y-3">
              <form action={createPostFromJobAction}>
                <input type="hidden" name="id" value={job.id} />
                <button type="submit" className={`${btnPrimary} w-full`}>
                  ✦ Create post from this job
                </button>
              </form>
              {job.photos.length === 0 ? (
                <p className="text-xs text-slate-400">
                  Tip: add before/after photos first so the post has something to show.
                </p>
              ) : null}
              {job.posts.length > 0 ? (
                <ul className="space-y-1.5">
                  {job.posts.map((post) => (
                    <li key={post.id}>
                      <Link
                        href={`/social/${post.id}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <span className="truncate text-slate-700">
                          {post.caption.split('\n')[0] || 'Untitled post'}
                        </span>
                        <PostStatusBadge status={post.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
              {job.status === 'COMPLETED' && settings.googleReviewUrl ? (
                <CopyButton
                  text={settings.googleReviewUrl}
                  className={`${btnSecondary} ${btnSmall} w-full`}
                >
                  Copy review link for {job.customer.name.split(' ')[0]}
                </CopyButton>
              ) : null}
            </div>
          </Card>

          <Card title="Customer">
            <div className="space-y-1 text-sm">
              <Link
                href={`/customers/${job.customer.id}`}
                className="font-medium text-cyan-700 hover:underline"
              >
                {job.customer.name}
              </Link>
              {job.customer.phone ? (
                <p>
                  <a href={`tel:${job.customer.phone}`} className="text-slate-600 hover:underline">
                    {job.customer.phone}
                  </a>
                </p>
              ) : null}
              {job.customer.email ? (
                <p>
                  <a
                    href={`mailto:${job.customer.email}`}
                    className="text-slate-600 hover:underline"
                  >
                    {job.customer.email}
                  </a>
                </p>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
