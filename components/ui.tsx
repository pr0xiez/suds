import type { Icon } from '@phosphor-icons/react'
import {
  ArrowLeftIcon,
  FacebookLogoIcon,
  GoogleLogoIcon,
  InstagramLogoIcon,
  TiktokLogoIcon,
} from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import Link from 'next/link'
import type { JobStatus, PhotoKind, Platform, PostStatus } from '@/lib/generated/prisma/enums'

/**
 * The app's small design system: shared class strings and tiny presentational
 * components built on the semantic tokens in app/globals.css. Status is always
 * color + text, never color alone. Rules live in docs/design.md.
 */

// ---------------------------------------------------------------------------
// Buttons & form controls (class constants — usable from server and client)
// ---------------------------------------------------------------------------

const btnBase =
  'inline-flex min-h-10 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control px-4 py-2 text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0'

export const btnPrimary = clsx(btnBase, 'bg-primary text-on-primary hover:bg-primary-hover')
/** Lime fill. Reserve for the single most important action on public pages. */
export const btnAccent = clsx(btnBase, 'bg-accent text-on-accent hover:bg-accent-strong')
export const btnSecondary = clsx(
  btnBase,
  'border border-line-strong/70 bg-surface text-ink shadow-panel hover:border-line-strong hover:bg-surface-2',
)
export const btnDanger = clsx(
  btnBase,
  'border border-danger-line bg-surface text-danger hover:bg-danger-soft',
)
export const btnGhost = clsx(btnBase, 'text-ink-muted hover:bg-surface-2 hover:text-ink')
/** Append to any button class. Important-flagged so it always beats the base size. */
export const btnSmall = 'min-h-8! gap-1.5! px-2.5! py-1! text-xs! [&_svg]:size-3.5!'

/** Inline text link in the accent ink. */
export const linkClass =
  'font-medium text-accent-ink underline-offset-4 hover:underline focus-visible:underline'

const controlBase =
  'block w-full rounded-control border border-line-strong bg-surface px-3 py-2 text-base text-ink transition-colors placeholder:text-ink-faint hover:border-ink-faint focus:border-focus focus:outline-none focus:ring-3 focus:ring-focus/20 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-danger sm:text-sm'

export const inputClass = clsx(controlBase, 'min-h-10')
export const selectClass = clsx(controlBase, 'min-h-10 pr-8')
export const textareaClass = clsx(controlBase, 'min-h-24 leading-relaxed')
export const labelClass = 'mb-1.5 block text-sm font-medium text-ink'
export const hintClass = 'mt-1.5 text-xs text-ink-muted'

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: callers nest the control via children
    <label className={clsx('block', className)}>
      <span className={labelClass}>{label}</span>
      {children}
      {hint && !error ? <span className={clsx(hintClass, 'block')}>{hint}</span> : null}
      {error ? (
        <span role="alert" className="mt-1.5 block text-xs font-medium text-danger">
          {error}
        </span>
      ) : null}
    </label>
  )
}

/** Segmented control (filters such as upcoming / past / all). */
export const segmentTrack =
  'inline-flex max-w-full overflow-x-auto rounded-control border border-line bg-surface-2 p-0.5'
export function segmentClass(active: boolean) {
  return clsx(
    'inline-flex min-h-8 items-center gap-1.5 whitespace-nowrap rounded-[0.5rem] px-3 text-sm font-medium transition-colors',
    active ? 'bg-surface text-ink shadow-panel' : 'text-ink-muted hover:text-ink',
  )
}

/** Data tables: wrap in Card padded={false} > div.overflow-x-auto. */
export const thClass = 'px-4 py-2.5 text-left text-xs font-medium text-ink-muted'
export const tdClass = 'px-4 py-3'

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  back?: { href: string; label: string }
}) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0">
        {back ? (
          <Link
            href={back.href}
            className="mb-3 inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-ink"
          >
            <ArrowLeftIcon aria-hidden className="size-4" />
            {back.label}
          </Link>
        ) : null}
        <h1 className="font-display text-2xl font-bold leading-tight text-ink sm:text-[1.75rem]">
          {title}
        </h1>
        {subtitle ? <p className="mt-1.5 text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
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
    <section
      className={clsx(
        'min-w-0 rounded-panel border border-line bg-surface shadow-panel',
        className,
      )}
    >
      {title || actions ? (
        <header className="flex min-h-13 items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold text-ink">{title}</h2>
          {actions}
        </header>
      ) : null}
      <div className={padded ? 'p-4 sm:p-5' : undefined}>{children}</div>
    </section>
  )
}

export function EmptyState({
  title,
  hint,
  icon: IconComponent,
  action,
}: {
  title: string
  hint?: React.ReactNode
  icon?: Icon
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center rounded-control border border-dashed border-line-strong/60 px-6 py-10 text-center">
      {IconComponent ? (
        <span className="mb-3 grid size-10 place-items-center rounded-full bg-surface-2 text-ink-muted">
          <IconComponent aria-hidden className="size-5" />
        </span>
      ) : null}
      <p className="text-sm font-medium text-ink">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-sm text-ink-muted">{hint}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tones — semantic color families shared by badges, callouts and calendar chips
// ---------------------------------------------------------------------------

export type Tone = 'neutral' | 'info' | 'warn' | 'ok' | 'danger' | 'accent'

const TONE_BADGE: Record<Tone, string> = {
  neutral: 'border-line bg-surface-2 text-ink-muted',
  info: 'border-info-line bg-info-soft text-info',
  warn: 'border-warn-line bg-warn-soft text-warn',
  ok: 'border-ok-line bg-ok-soft text-ok',
  danger: 'border-danger-line bg-danger-soft text-danger',
  accent: 'border-accent-line bg-accent-soft text-accent-ink',
}

/** Left-edge calendar/timeline blocks. */
const TONE_CHIP: Record<Tone, string> = {
  neutral: 'border-line-strong bg-surface-2 text-ink-muted hover:bg-surface-3',
  info: 'border-info bg-info-soft text-ink hover:border-ink',
  warn: 'border-warn bg-warn-soft text-ink hover:border-ink',
  ok: 'border-ok bg-ok-soft text-ink hover:border-ink',
  danger: 'border-danger bg-danger-soft text-ink hover:border-ink',
  accent: 'border-accent-ink bg-accent-soft text-ink hover:border-ink',
}

export const TONE_CALLOUT: Record<Tone, string> = {
  neutral: 'border-line bg-surface',
  info: 'border-info-line bg-info-soft',
  warn: 'border-warn-line bg-warn-soft',
  ok: 'border-ok-line bg-ok-soft',
  danger: 'border-danger-line bg-danger-soft',
  accent: 'border-accent-line bg-accent-soft',
}

const TONE_ICON: Record<Tone, string> = {
  neutral: 'text-ink-muted',
  info: 'text-info',
  warn: 'text-warn',
  ok: 'text-ok',
  danger: 'text-danger',
  accent: 'text-accent-ink',
}

export function Badge({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium',
        TONE_BADGE[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}

/** A tinted panel for page-level prompts: setup nudges, waiting requests, warnings. */
export function Callout({
  tone = 'neutral',
  icon: IconComponent,
  title,
  children,
  action,
  className,
}: {
  tone?: Tone
  icon?: Icon
  title: React.ReactNode
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={clsx(
        'flex flex-col gap-3 rounded-panel border p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-5',
        TONE_CALLOUT[tone],
        className,
      )}
    >
      {IconComponent ? (
        <IconComponent aria-hidden className={clsx('size-6 shrink-0', TONE_ICON[tone])} />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink">{title}</p>
        {children ? <div className="mt-1 text-sm text-ink-muted">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Status — color + label, always together
// ---------------------------------------------------------------------------

const JOB_TONE: Record<JobStatus, Tone> = {
  SCHEDULED: 'info',
  IN_PROGRESS: 'warn',
  COMPLETED: 'ok',
  CANCELED: 'neutral',
  NO_SHOW: 'danger',
}

const JOB_LABEL: Record<JobStatus, string> = {
  SCHEDULED: 'Scheduled',
  IN_PROGRESS: 'In progress',
  COMPLETED: 'Completed',
  CANCELED: 'Canceled',
  NO_SHOW: 'No-show',
}

export const JOB_STATUS_META: Record<
  JobStatus,
  { label: string; tone: Tone; badge: string; chip: string }
> = Object.fromEntries(
  (Object.keys(JOB_TONE) as JobStatus[]).map((status) => {
    const tone = JOB_TONE[status]
    return [
      status,
      {
        label: JOB_LABEL[status],
        tone,
        badge: TONE_BADGE[tone],
        chip: clsx(TONE_CHIP[tone], status === 'CANCELED' && 'line-through'),
      },
    ]
  }),
) as Record<JobStatus, { label: string; tone: Tone; badge: string; chip: string }>

export function JobStatusBadge({ status }: { status: JobStatus }) {
  const meta = JOB_STATUS_META[status]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

export const POST_STATUS_META: Record<PostStatus, { label: string; tone: Tone; badge: string }> = {
  DRAFT: { label: 'Draft', tone: 'neutral', badge: TONE_BADGE.neutral },
  SCHEDULED: { label: 'Scheduled', tone: 'info', badge: TONE_BADGE.info },
  POSTED: { label: 'Posted', tone: 'ok', badge: TONE_BADGE.ok },
}

export function PostStatusBadge({ status, overdue }: { status: PostStatus; overdue?: boolean }) {
  if (status === 'SCHEDULED' && overdue) return <Badge tone="danger">Overdue</Badge>
  const meta = POST_STATUS_META[status]
  return <Badge tone={meta.tone}>{meta.label}</Badge>
}

/** Platforms are told apart by their logo glyph, not by a rainbow of chip colors. */
export const PLATFORM_META: Record<
  Platform,
  { label: string; short: string; chip: string; icon: Icon }
> = {
  INSTAGRAM: { label: 'Instagram', short: 'IG', chip: TONE_BADGE.neutral, icon: InstagramLogoIcon },
  FACEBOOK: { label: 'Facebook', short: 'FB', chip: TONE_BADGE.neutral, icon: FacebookLogoIcon },
  TIKTOK: { label: 'TikTok', short: 'TT', chip: TONE_BADGE.neutral, icon: TiktokLogoIcon },
  GOOGLE_BUSINESS: {
    label: 'Google Business',
    short: 'GB',
    chip: TONE_BADGE.neutral,
    icon: GoogleLogoIcon,
  },
}

export function PlatformChips({ platforms }: { platforms: Platform[] }) {
  if (platforms.length === 0) return null
  return (
    <span className="inline-flex flex-wrap gap-1">
      {platforms.map((platform) => {
        const meta = PLATFORM_META[platform]
        const PlatformIcon = meta.icon
        return (
          <span
            key={platform}
            title={meta.label}
            className="inline-grid size-6 place-items-center rounded-tight border border-line bg-surface-2 text-ink-muted"
          >
            <PlatformIcon aria-hidden className="size-3.5" />
            <span className="sr-only">{meta.label}</span>
          </span>
        )
      })}
    </span>
  )
}

/** Sits on top of photos, so it uses fixed fills rather than surface tokens. */
export const PHOTO_KIND_META: Record<PhotoKind, { label: string; badge: string }> = {
  BEFORE: { label: 'Before', badge: 'bg-chrome/85 text-chrome-ink' },
  AFTER: { label: 'After', badge: 'bg-accent text-on-accent' },
  OTHER: { label: 'Other', badge: 'bg-surface/90 text-ink' },
}

export function PhotoKindBadge({ kind }: { kind: PhotoKind }) {
  const meta = PHOTO_KIND_META[kind]
  return (
    <span
      className={clsx(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold backdrop-blur-sm',
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
  className,
}: {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  href?: string
  className?: string
}) {
  const body = (
    <>
      <p className="text-sm text-ink-muted">{label}</p>
      <p className="mt-2 font-display text-2xl font-semibold tabular-nums leading-none text-ink sm:text-[1.75rem]">
        {value}
      </p>
      {detail ? <p className="mt-2 text-xs text-ink-muted">{detail}</p> : null}
    </>
  )
  const frame = clsx('block p-4 sm:p-5', className)
  if (href) {
    return (
      <Link href={href} className={clsx(frame, 'transition-colors hover:bg-surface-2')}>
        {body}
      </Link>
    )
  }
  return <div className={frame}>{body}</div>
}
