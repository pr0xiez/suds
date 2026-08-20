import clsx from 'clsx'
import Link from 'next/link'

const TABS = [
  { href: '/settings', label: 'Business' },
  { href: '/settings/services', label: 'Services' },
  { href: '/settings/templates', label: 'Caption templates' },
  { href: '/settings/users', label: 'Users', ownerOnly: true },
]

export function SettingsNav({ current, isOwner }: { current: string; isOwner: boolean }) {
  return (
    <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200 pb-px">
      {TABS.filter((tab) => !tab.ownerOnly || isOwner).map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={clsx(
            'rounded-t-lg border-b-2 px-3 py-2 text-sm font-medium',
            current === tab.href
              ? 'border-cyan-700 text-cyan-700'
              : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
