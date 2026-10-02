import clsx from 'clsx'

/** The Suds bubble mark. Color comes from `currentColor`; size from className. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 28 28"
      className={clsx('shrink-0', className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
    >
      <circle cx="10" cy="17" r="7" />
      <circle cx="21" cy="7" r="4" />
      <circle cx="22" cy="22" r="2.5" />
    </svg>
  )
}

/** Mark + wordmark. `tone="chrome"` is for the dark sidebar and bars. */
export function Logo({
  className,
  tone = 'page',
}: {
  className?: string
  tone?: 'page' | 'chrome'
}) {
  return (
    <span className={clsx('inline-flex items-center gap-2', className)}>
      <LogoMark className={clsx('size-7', tone === 'chrome' ? 'text-accent' : 'text-accent-ink')} />
      <span
        className={clsx(
          'font-display text-xl font-bold leading-none',
          tone === 'chrome' ? 'text-chrome-ink' : 'text-ink',
        )}
      >
        Suds
      </span>
    </span>
  )
}
