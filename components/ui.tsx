import clsx from 'clsx'
import type { JobStatus, PhotoKind, Platform, PostStatus } from '@/lib/generated/prisma/enums'

/**
 * The app's small design system: shared class strings and tiny presentational
 * components. Status is always color + text, never color alone.
 */

// ---------------------------------------------------------------------------
// Buttons & form controls (class constants — usable from server and client)
// ---------------------------------------------------------------------------

const btnBase =
  'inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none'

export const btnPrimary = clsx(btnBase, 'bg-cyan-700 text-white hover:bg-cyan-800')
export const btnSecondary = clsx(
  btnBase,
  'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50',
)
export const btnDanger = clsx(
  btnBase,
  'bg-white text-rose-700 border border-rose-200 hover:bg-rose-50',
)
export const btnGhost = clsx(btnBase, 'text-slate-600 hover:bg-slate-200/70')
export const btnSmall = 'px-2.5 py-1.5 text-xs'

export const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-cyan-600 focus:outline-none focus:ring-2 focus:ring-cyan-600/20'
export const selectClass = inputClass
export const textareaClass = clsx(inputClass, 'min-h-24 leading-relaxed')
export const labelClass = 'block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1'

export function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: callers nest the control via children
    <label className={clsx('block', className)}>
      <span className={labelClass}>{label}</span>
      {children}
    </label>
  )
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export function Card({
  title,
  actions,
  children,
  className,
  padded = true,
}: {
  title?: React.ReactNode
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
  padded?: boolean
}) {
  return (
    <section className={clsx('rounded-xl border border-slate-200 bg-white shadow-sm', className)}>
      {title || actions ? (
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div className={padded ? 'p-4' : undefined}>{children}</div>
    </section>
  )
}

export function EmptyState({ title, hint }: { title: string; hint?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 px-6 py-10 text-center">
      <p className="text-sm font-medium text-slate-600">{title}</p>
      {hint ? <p className="mt-1 text-sm text-slate-400">{hint}</p> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status — color + label, always together
// ---------------------------------------------------------------------------

export const JOB_STATUS_META: Record<JobStatus, { label: string; badge: string; chip: string }> = {
  SCHEDULED: {
    label: 'Scheduled',
    badge: 'bg-sky-100 text-sky-800 border-sky-200',
    chip: 'bg-sky-50 border-sky-500 text-sky-900 hover:bg-sky-100',
  },
  IN_PROGRESS: {
    label: 'In progress',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    chip: 'bg-amber-50 border-amber-500 text-amber-900 hover:bg-amber-100',
  },
  COMPLETED: {
    label: 'Completed',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    chip: 'bg-emerald-50 border-emerald-500 text-emerald-900 hover:bg-emerald-100',
  },
  CANCELED: {
    label: 'Canceled',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    chip: 'bg-slate-50 border-slate-400 text-slate-500 line-through hover:bg-slate-100',
  },
  NO_SHOW: {
    label: 'No-show',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    chip: 'bg-rose-50 border-rose-500 text-rose-900 hover:bg-rose-100',
  },
}

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const meta = JOB_STATUS_META[status]
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        meta.badge,
      )}
    >
      {meta.label}
    </span>
  )
}

export const POST_STATUS_META: Record<PostStatus, { label: string; badge: string }> = {
  DRAFT: { label: 'Draft', badge: 'bg-slate-100 text-slate-600 border-slate-200' },
  SCHEDULED: { label: 'Scheduled', badge: 'bg-sky-100 text-sky-800 border-sky-200' },
  POSTED: { label: 'Posted', badge: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
}

export function PostStatusBadge({ status, overdue }: { status: PostStatus; overdue?: boolean }) {
  if (status === 'SCHEDULED' && overdue) {
    return (
      <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800">
        Overdue
      </span>
    )
  }
  const meta = POST_STATUS_META[status]
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium',
        meta.badge,
      )}
    >
      {meta.label}
    </span>
  )
}

export const PLATFORM_META: Record<Platform, { label: string; short: string; chip: string }> = {
  INSTAGRAM: {
    label: 'Instagram',
    short: 'IG',
    chip: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200',
  },
  FACEBOOK: { label: 'Facebook', short: 'FB', chip: 'bg-blue-100 text-blue-800 border-blue-200' },
  TIKTOK: { label: 'TikTok', short: 'TT', chip: 'bg-slate-800 text-slate-100 border-slate-700' },
  GOOGLE_BUSINESS: {
    label: 'Google Business',
    short: 'GB',
    chip: 'bg-green-100 text-green-800 border-green-200',
  },
}

export function PlatformChips({ platforms }: { platforms: Platform[] }) {
  if (platforms.length === 0) return null
  return (
    <span className="inline-flex flex-wrap gap-1">
      {platforms.map((platform) => {
        const meta = PLATFORM_META[platform]
        return (
          <span
            key={platform}
            title={meta.label}
            className={clsx(
              'inline-flex items-center rounded border px-1.5 py-0.5 text-[10px] font-bold',
              meta.chip,
            )}
          >
            {meta.short}
          </span>
        )
      })}
    </span>
  )
}

export const PHOTO_KIND_META: Record<PhotoKind, { label: string; badge: string }> = {
  BEFORE: { label: 'Before', badge: 'bg-orange-100 text-orange-800' },
  AFTER: { label: 'After', badge: 'bg-emerald-100 text-emerald-800' },
  OTHER: { label: 'Other', badge: 'bg-slate-100 text-slate-600' },
}

export function PhotoKindBadge({ kind }: { kind: PhotoKind }) {
  const meta = PHOTO_KIND_META[kind]
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
        meta.badge,
      )}
    >
      {meta.label}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Stat tile — a headline number is a tile, not a chart
// ---------------------------------------------------------------------------

export function StatTile({
  label,
  value,
  detail,
  href,
}: {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  href?: string
}) {
  const body = (
    <>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </>
  )
  const frame = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm'
  if (href) {
    return (
      <a href={href} className={clsx(frame, 'block transition-colors hover:border-cyan-300')}>
        {body}
      </a>
    )
  }
  return <div className={frame}>{body}</div>
}
