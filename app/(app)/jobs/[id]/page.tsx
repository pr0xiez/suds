import type { Icon } from '@phosphor-icons/react'
import {
  ArrowCounterClockwiseIcon,
  CameraIcon,
  CheckCircleIcon,
  CheckIcon,
  ClockIcon,
  EnvelopeSimpleIcon,
  MapPinIcon,
  MegaphoneIcon,
  PencilSimpleIcon,
  PhoneIcon,
  PlayIcon,
  ReceiptIcon,
  StarIcon,
  TrashIcon,
  UploadSimpleIcon,
  UserMinusIcon,
  XCircleIcon,
} from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
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
  Badge,
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSmall,
  Card,
  EmptyState,
  Field,
  inputClass,
  JobStatusBadge,
  linkClass,
  PageHeader,
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

const TRANSITION_META: Record<
  JobStatus,
  { label: string; className: string; icon: Icon; confirm?: string }
> = {
  IN_PROGRESS: { label: 'Start', className: btnPrimary, icon: PlayIcon },
  COMPLETED: { label: 'Complete', className: btnPrimary, icon: CheckIcon },
  SCHEDULED: {
    label: 'Reopen',
    className: btnSecondary,
    icon: ArrowCounterClockwiseIcon,
    confirm: 'Reopen this job?',
  },
  CANCELED: {
    label: 'Cancel job',
    className: btnDanger,
    icon: XCircleIcon,
    confirm: 'Cancel this job?',
  },
  NO_SHOW: {
    label: 'No-show',
    className: btnDanger,
    icon: UserMinusIcon,
    confirm: 'Mark as a no-show?',
  },
}
const TRANSITION_ORDER: JobStatus[] = [
  'IN_PROGRESS',
  'COMPLETED',
  'SCHEDULED',
  'CANCELED',
  'NO_SHOW',
]
/** Outcomes that end a job badly sit apart from the forward actions. */
const CLOSING_TRANSITIONS: JobStatus[] = ['CANCELED', 'NO_SHOW']

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

  // With Start on offer, Complete is the second choice rather than a second primary.
  const transitionButton = (target: JobStatus) => {
    const meta = TRANSITION_META[target]
    const TransitionIcon = meta.icon
    const className =
      target === 'COMPLETED' && transitions.includes('IN_PROGRESS') ? btnSecondary : meta.className
    return (
      <form key={target} action={setJobStatusAction}>
        <input type="hidden" name="id" value={job.id} />
        <input type="hidden" name="status" value={target} />
        <input type="hidden" name="back" value={backPath} />
        {meta.confirm ? (
          <ConfirmSubmit message={meta.confirm} className={className}>
            <TransitionIcon aria-hidden />
            {meta.label}
          </ConfirmSubmit>
        ) : (
          <button type="submit" className={className}>
            <TransitionIcon aria-hidden />
            {meta.label}
          </button>
        )}
      </form>
    )
  }
  const forwardTransitions = transitions.filter((t) => !CLOSING_TRANSITIONS.includes(t))
  const closingTransitions = transitions.filter((t) => CLOSING_TRANSITIONS.includes(t))

  return (
    <div>
      <PageHeader
        back={{ href: '/jobs', label: 'Jobs' }}
        title={job.customer.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <span>{describeVehicle(job.vehicle)}</span>
            {job.vehicle.plate ? (
              <span className="rounded-tight border border-line bg-surface-2 px-1.5 py-px font-mono text-xs text-ink">
                {job.vehicle.plate}
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            <Link href={`/jobs/${job.id}/edit`} className={btnSecondary}>
              <PencilSimpleIcon aria-hidden />
              Edit
            </Link>
            <form action={deleteJobAction}>
              <input type="hidden" name="id" value={job.id} />
              <ConfirmSubmit
                message="Delete this job, its photos, and its files? This can't be undone."
                className={btnDanger}
              >
                <TrashIcon aria-hidden />
                Delete
              </ConfirmSubmit>
            </form>
          </>
        }
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={saved ? 'Saved.' : null} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {/* When, status, and what to do next */}
          <section
            aria-label="Status"
            className="overflow-hidden rounded-panel border border-line bg-surface shadow-panel"
          >
            <div className="p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <JobStatusBadge status={job.status} />
                {job.paidAt ? (
                  <Badge tone="ok">Paid</Badge>
                ) : job.status === 'COMPLETED' ? (
                  <Badge tone="warn">Unpaid</Badge>
                ) : null}
              </div>
              <p className="mt-2.5 font-display text-xl font-semibold tabular-nums text-ink sm:text-2xl">
                {formatDateTime(job.scheduledAt, tz)}
              </p>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-ink-muted">
                <ClockIcon aria-hidden className="size-4" />
                {minutesToHuman(job.durationMin)}
              </p>
            </div>
            {transitions.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/50 px-4 py-3 sm:px-5">
                {forwardTransitions.map(transitionButton)}
                {closingTransitions.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
                    {closingTransitions.map(transitionButton)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <Card title="Line items" padded={false}>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-line">
                {job.items.map((item) => (
                  <tr key={item.id}>
                    <td className="px-4 py-3 sm:px-5">
                      <span className="font-medium text-ink">{item.name}</span>
                      <span className="ml-2 text-xs tabular-nums text-ink-muted">
                        {minutesToHuman(item.durationMin)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink sm:px-5">
                      {formatCents(item.priceCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-line bg-surface-2/50">
                {job.discountCents > 0 ? (
                  <>
                    <tr>
                      <td className="px-4 pt-3 text-ink-muted sm:px-5">Subtotal</td>
                      <td className="px-4 pt-3 text-right tabular-nums text-ink sm:px-5">
                        {formatCents(subtotal)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 pt-1.5 text-ink-muted sm:px-5">Discount</td>
                      <td className="px-4 pt-1.5 text-right tabular-nums text-ink-muted sm:px-5">
                        −{formatCents(job.discountCents)}
                      </td>
                    </tr>
                  </>
                ) : null}
                <tr>
                  <td className="px-4 py-3 font-semibold text-ink sm:px-5">Total</td>
                  <td className="px-4 py-3 text-right text-base font-semibold tabular-nums text-ink sm:px-5">
                    {formatCents(total)}
                  </td>
                </tr>
                {job.tipCents > 0 ? (
                  <tr>
                    <td className="px-4 pb-3 text-ink-muted sm:px-5">Tip</td>
                    <td className="px-4 pb-3 text-right tabular-nums text-ok sm:px-5">
                      +{formatCents(job.tipCents)}
                    </td>
                  </tr>
                ) : null}
              </tfoot>
            </table>
          </Card>

          <Card title="Payment">
            {job.paidAt ? (
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ok-soft text-ok">
                    <CheckCircleIcon aria-hidden className="size-5" />
                  </span>
                  <div className="min-w-0 text-sm">
                    <p className="font-semibold text-ok">
                      Paid {formatCents(total + job.tipCents)}
                      {job.tipCents > 0 ? ` (incl. ${formatCents(job.tipCents)} tip)` : ''}
                    </p>
                    <p className="mt-0.5 text-ink-muted">
                      {PAYMENT_LABELS[job.paymentMethod ?? 'OTHER']} ·{' '}
                      {formatDateTime(job.paidAt, tz)}
                    </p>
                  </div>
                </div>
                <form action={clearPaymentAction} className="shrink-0">
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
              <form
                action={recordPaymentAction}
                className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
              >
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
                <button type="submit" className={btnPrimary}>
                  <CheckIcon aria-hidden />
                  Mark paid · {formatCents(total)}
                </button>
              </form>
            )}
          </Card>

          <Card
            title={`Photos (${job.photos.length})`}
            actions={
              <span className="text-right text-xs text-ink-muted">
                Befores and afters fuel the social side
              </span>
            }
          >
            {durableStorageConfigured() ? (
              <MediaUploader jobId={job.id} />
            ) : (
              <form
                method="post"
                action={`/api/jobs/${job.id}/photos`}
                encType="multipart/form-data"
                className="mb-5 grid grid-cols-1 gap-2 rounded-control border border-dashed border-line-strong/60 p-3 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center"
              >
                <select
                  name="kind"
                  aria-label="Photo type"
                  className={selectClass}
                  defaultValue="BEFORE"
                >
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
                  aria-label="Photos"
                  className="min-w-0 text-sm text-ink-muted file:mr-3 file:min-h-10 file:cursor-pointer file:rounded-control file:border-0 file:bg-surface-2 file:px-3 file:py-2 file:text-sm file:font-medium file:text-ink hover:file:bg-surface-3"
                />
                <button type="submit" className={btnSecondary}>
                  <UploadSimpleIcon aria-hidden />
                  Upload
                </button>
              </form>
            )}
            {job.photos.length === 0 ? (
              <EmptyState
                icon={CameraIcon}
                title="No photos yet"
                hint="Snap befores when the car arrives and afters before it leaves."
              />
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
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
            <Card title="Notes">
              <dl
                className={clsx(
                  'grid grid-cols-1 gap-5',
                  job.notes && job.internalNotes && 'sm:grid-cols-2',
                )}
              >
                {job.notes ? (
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-ink-muted">Job notes</dt>
                    <dd className="mt-1.5 whitespace-pre-wrap break-words text-sm text-ink">
                      {job.notes}
                    </dd>
                  </div>
                ) : null}
                {job.internalNotes ? (
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-ink-muted">Internal notes</dt>
                    <dd className="mt-1.5 whitespace-pre-wrap break-words text-sm text-ink">
                      {job.internalNotes}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </Card>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6 lg:self-start">
          <Card title="Customer">
            <Link href={`/customers/${job.customer.id}`} className={linkClass}>
              {job.customer.name}
            </Link>
            {job.customer.phone || job.customer.email ? (
              <ul className="mt-3 space-y-2 text-sm">
                {job.customer.phone ? (
                  <li>
                    <a
                      href={`tel:${job.customer.phone}`}
                      className="inline-flex min-h-6 items-center gap-2 text-ink-muted transition-colors hover:text-ink"
                    >
                      <PhoneIcon aria-hidden className="size-4 shrink-0" />
                      <span className="tabular-nums">{job.customer.phone}</span>
                    </a>
                  </li>
                ) : null}
                {job.customer.email ? (
                  <li className="min-w-0">
                    <a
                      href={`mailto:${job.customer.email}`}
                      className="inline-flex min-h-6 max-w-full items-center gap-2 text-ink-muted transition-colors hover:text-ink"
                    >
                      <EnvelopeSimpleIcon aria-hidden className="size-4 shrink-0" />
                      <span className="min-w-0 truncate">{job.customer.email}</span>
                    </a>
                  </li>
                ) : null}
              </ul>
            ) : null}
          </Card>

          {job.locationAddress || job.waterPowerNotes ? (
            <Card title="Location">
              <dl className="space-y-4 text-sm">
                {job.locationAddress ? (
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-ink-muted">Address</dt>
                    <dd className="mt-1.5 flex items-start gap-2 text-ink">
                      <MapPinIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-faint" />
                      <span className="min-w-0 whitespace-pre-wrap break-words">
                        {job.locationAddress}
                      </span>
                    </dd>
                  </div>
                ) : null}
                {job.waterPowerNotes ? (
                  <div className="min-w-0">
                    <dt className="text-xs font-medium text-ink-muted">Water, power and parking</dt>
                    <dd className="mt-1.5 whitespace-pre-wrap break-words text-ink">
                      {job.waterPowerNotes}
                    </dd>
                  </div>
                ) : null}
              </dl>
            </Card>
          ) : null}

          <Card
            title="Invoice"
            actions={
              job.invoiceNumber !== null ? (
                <Link
                  href={`/jobs/${job.id}/invoice`}
                  className={`${btnSecondary} ${btnSmall} shrink-0`}
                >
                  <ReceiptIcon aria-hidden />
                  View / print
                </Link>
              ) : null
            }
          >
            {job.invoiceNumber !== null ? (
              <div className="text-sm">
                <p className="font-medium text-ink">
                  Invoice <span className="font-mono">#{job.invoiceNumber}</span>
                </p>
                {job.invoicedAt ? (
                  <p className="mt-0.5 text-ink-muted">
                    Issued {formatDateTime(job.invoicedAt, tz)}
                  </p>
                ) : null}
              </div>
            ) : (
              <form action={generateInvoiceAction}>
                <input type="hidden" name="id" value={job.id} />
                <button type="submit" className={`${btnSecondary} w-full`}>
                  <ReceiptIcon aria-hidden />
                  Generate invoice
                </button>
              </form>
            )}
          </Card>

          <Card title="Social">
            <div className="space-y-3">
              <form action={createPostFromJobAction}>
                <input type="hidden" name="id" value={job.id} />
                <button type="submit" className={`${btnSecondary} w-full`}>
                  <MegaphoneIcon aria-hidden />
                  Create post from this job
                </button>
              </form>
              {job.photos.length === 0 ? (
                <p className="text-xs text-ink-muted">
                  Tip: add before/after photos first so the post has something to show.
                </p>
              ) : null}
              {job.posts.length > 0 ? (
                <ul className="divide-y divide-line overflow-hidden rounded-control border border-line">
                  {job.posts.map((post) => (
                    <li key={post.id}>
                      <Link
                        href={`/social/${post.id}`}
                        className="flex items-center justify-between gap-2 px-3 py-2.5 text-sm transition-colors hover:bg-surface-2"
                      >
                        <span className="min-w-0 truncate text-ink">
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
                  <StarIcon aria-hidden />
                  Copy review link for {job.customer.name.split(' ')[0]}
                </CopyButton>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  )
}
