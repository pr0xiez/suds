'use client'

import clsx from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

function within(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`)
}

function useActive(href: string, exact: boolean, also: string[]) {
  const pathname = usePathname()
  if (exact) return pathname === href
  return within(pathname, href) || also.some((path) => within(pathname, path))
}

const VARIANTS = {
  sidebar: {
    base: 'flex min-h-9 items-center gap-3 rounded-control px-3 text-sm font-medium transition-colors [&_svg]:size-[18px] [&_svg]:shrink-0',
    active: 'bg-chrome-2 text-chrome-ink [&_svg]:text-accent',
    idle: 'text-chrome-muted hover:bg-chrome-2/60 hover:text-chrome-ink',
  },
  tab: {
    base: 'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors [&_svg]:size-[22px]',
    active: 'text-chrome-ink [&_svg]:text-accent',
    idle: 'text-chrome-muted hover:text-chrome-ink',
  },
}

export function NavLink({
  href,
  children,
  exact = false,
  also = [],
  variant = 'sidebar',
}: {
  href: string
  children: React.ReactNode
  exact?: boolean
  /** Other sections that belong to this item, e.g. /availability under Settings. */
  also?: string[]
  variant?: keyof typeof VARIANTS
}) {
  const active = useActive(href, exact, also)
  const style = VARIANTS[variant]
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={clsx(style.base, active ? style.active : style.idle)}
    >
      {children}
    </Link>
  )
}

/**
 * The phone "More" sheet. A native popover gives light-dismiss, Escape and a
 * backdrop for free; this only closes it again after client-side navigation.
 */
export function MoreSheet({
  trigger,
  children,
  activePaths,
}: {
  trigger: React.ReactNode
  children: React.ReactNode
  activePaths: string[]
}) {
  const pathname = usePathname()
  const sheet = useRef<HTMLDivElement>(null)
  const active = activePaths.some((path) => within(pathname, path))

  useEffect(() => {
    if (!pathname) return
    const node = sheet.current
    if (node?.matches(':popover-open')) node.hidePopover()
  }, [pathname])

  return (
    <>
      <button
        type="button"
        popoverTarget="more-sheet"
        className={clsx(
          VARIANTS.tab.base,
          active ? VARIANTS.tab.active : VARIANTS.tab.idle,
          'cursor-pointer',
        )}
      >
        {trigger}
      </button>
      <div
        ref={sheet}
        id="more-sheet"
        popover="auto"
        className="inset-x-0 top-auto bottom-0 m-0 max-h-[85dvh] w-full max-w-none overflow-y-auto rounded-t-[1.25rem] border-0 border-t border-chrome-line bg-chrome p-0 pb-[env(safe-area-inset-bottom)] text-chrome-ink shadow-float backdrop:bg-chrome/60 backdrop:backdrop-blur-[2px]"
      >
        {children}
      </div>
    </>
  )
}
