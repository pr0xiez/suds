'use client'

import clsx from 'clsx'
import Link from 'next/link'
import { useEffect, useRef } from 'react'

const TABS = [
  { href: '/settings', label: 'Business' },
  { href: '/settings/services', label: 'Services' },
  { href: '/settings/templates', label: 'Caption templates' },
  { href: '/settings/users', label: 'Users', ownerOnly: true },
  { href: '/availability', label: 'Availability', ownerOnly: true },
  { href: '/settings/operations', label: 'Operations', ownerOnly: true },
]

export function SettingsNav({ current, isOwner }: { current: string; isOwner: boolean }) {
  const strip = useRef<HTMLElement>(null)

  // On phones the tab strip scrolls sideways; bring the current tab into view
  // without moving the page vertically.
  useEffect(() => {
    const node = strip.current
    const active = node?.querySelector<HTMLElement>('[aria-current="page"]')
    if (!node || !active || node.scrollWidth <= node.clientWidth) return
    node.scrollLeft = active.offsetLeft - (node.clientWidth - active.offsetWidth) / 2
  }, [])

  return (
    <nav
      ref={strip}
      aria-label="Settings sections"
      className="relative -mx-4 mb-8 overflow-x-auto border-b border-line px-4 sm:mx-0 sm:px-0"
    >
      <div className="flex gap-5">
        {TABS.filter((tab) => !tab.ownerOnly || isOwner).map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={current === tab.href ? 'page' : undefined}
            className={clsx(
              '-mb-px whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors',
              current === tab.href
                ? 'border-ink text-ink'
                : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  )
}
