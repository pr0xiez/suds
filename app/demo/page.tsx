import { ArrowRightIcon, FlaskIcon, InfoIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DemoSignIn } from '@/components/DemoToolbar'
import { Logo } from '@/components/Logo'
import { btnAccent, linkClass } from '@/components/ui'
import { DEMO_ACCOUNTS, DEMO_PASSWORD, demoEnabled } from '@/lib/demo'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Full app demo' }

const ownerFeatures = [
  {
    title: 'Run your day',
    text: 'Dashboard, a week schedule, time off, travel buffers, and upcoming work.',
    links: [
      ['Dashboard', '/dashboard'],
      ['Schedule', '/schedule'],
      ['Block time', '/availability'],
    ],
  },
  {
    title: 'Manage the whole job',
    text: 'Create and edit jobs, move work through its statuses, record payments and tips, and print invoices.',
    links: [
      ['Jobs & payments', '/jobs'],
      ['New job', '/jobs/new'],
    ],
  },
  {
    title: 'Know your customers',
    text: 'Customer records, multiple vehicles, service history, private notes, and secure invitations to the customer portal.',
    links: [['Customers & vehicles', '/customers']],
  },
  {
    title: 'Make marketing easy',
    text: 'Choose a completed detail, open appointments, or a business introduction. Prepare a sample assistant draft, edit it, and open the post composer.',
    links: [
      ['Try the assistant', '/marketing'],
      ['Post composer', '/social/new'],
    ],
  },
  {
    title: 'Plan your posts',
    text: 'Caption templates, ordered photos, a month content calendar, scheduled drafts, copy/download, and marking posts as published.',
    links: [
      ['Content calendar', '/social'],
      ['Caption templates', '/settings/templates'],
    ],
  },
  {
    title: 'Turn media into content',
    text: 'Upload before-and-after photos, approve their marketing use, and explore the photo-to-short and uploaded-video editing flows.',
    links: [
      ['Photo library', '/library'],
      ['Shorts editor', '/social/shorts'],
    ],
  },
  {
    title: 'Set up your business',
    text: 'Business profile, service menu and prices, hours, booking mode, service area, cancellation policy, and a public booking link.',
    links: [
      ['Business setup', '/onboarding'],
      ['Service catalog', '/settings/services'],
      ['Business settings', '/settings'],
    ],
  },
  {
    title: 'Manage access & operations',
    text: 'Invite staff, change business permissions, inspect queued notifications and assistant runs, and see provider connection status.',
    links: [
      ['Team', '/settings/users'],
      ['Operations', '/settings/operations'],
    ],
  },
]

const journey = [
  {
    step: '01',
    title: 'Book a detail',
    text: 'Open the customer view, choose a service and an available time, then confirm.',
    account: 'customer',
    next: '/b/suds-detailing',
    action: 'Try instant booking',
  },
  {
    step: '02',
    title: 'Run the job',
    text: 'Switch to owner, find the new job, update its progress, record payment, and print the invoice.',
    account: 'owner',
    next: '/jobs',
    action: 'Open jobs',
  },
  {
    step: '03',
    title: 'Make a post',
    text: 'Approve photos, choose a marketing task, prepare a sample draft, and save it in the content calendar.',
    account: 'owner',
    next: '/marketing',
    action: 'Try marketing',
  },
  {
    step: '04',
    title: 'See both sides',
    text: 'Return as the customer to see appointments, reschedule or cancel, manage vehicles, and view invoices.',
    account: 'customer',
    next: undefined,
    action: 'Open customer portal',
  },
] as const

const panel = 'min-w-0 rounded-panel border border-line bg-surface p-6 shadow-panel'
const arrowLink = `${linkClass} inline-flex items-center gap-1 text-sm`
const chromeButton =
  'inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-control border border-chrome-line px-5 text-sm font-medium text-chrome-ink transition-colors hover:bg-chrome-2 active:scale-[0.98] [&_svg]:size-4'

export default function DemoPage() {
  if (!demoEnabled()) notFound()
  return (
    <main className="min-h-dvh bg-canvas pb-32 text-ink">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 md:py-10 lg:px-8">
        <header className="rounded-[1.25rem] bg-chrome p-7 text-chrome-ink md:p-10">
          <div className="flex flex-wrap items-center gap-3">
            <Logo tone="chrome" />
            <span className="inline-flex items-center gap-1.5 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent">
              <FlaskIcon aria-hidden className="size-3.5" />
              Interactive app demo
            </span>
          </div>
          <h1 className="mt-8 max-w-3xl font-display text-4xl font-bold leading-[1.05] text-balance md:text-5xl">
            From first booking to your next great post.
          </h1>
          <p className="mt-5 max-w-2xl leading-relaxed text-chrome-muted">
            Try the owner workspace and a separate customer experience, with fictional jobs, photos,
            invoices, and appointments ready to explore.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <DemoSignIn accountRole="owner" className={`${btnAccent} min-h-11! px-5!`}>
              Open owner app
              <ArrowRightIcon aria-hidden />
            </DemoSignIn>
            <DemoSignIn accountRole="customer" className={chromeButton}>
              Open customer app
              <ArrowRightIcon aria-hidden />
            </DemoSignIn>
            <DemoSignIn accountRole="staff" className={chromeButton}>
              Try staff access
            </DemoSignIn>
          </div>
        </header>
        <div className="mt-6 flex items-start gap-3 rounded-panel border border-info-line bg-info-soft p-5 text-sm leading-relaxed text-ink">
          <InfoIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-info" />
          <p className="min-w-0">
            Bookings, jobs, payments, photo uploads, and social drafts save to a separate demo
            database. The marketing assistant uses simulated responses. Shorts rendering has an
            interactive workflow preview; live AI providers and private cloud storage are not
            connected. Email stays in the{' '}
            <Link href="/demo/inbox" className={linkClass}>
              demo inbox
            </Link>
            . Social publishing is a manual copy/download flow.
          </p>
        </div>
        <section aria-labelledby="walkthrough" className={`${panel} mt-6 md:p-8`}>
          <h2 id="walkthrough" className="font-display text-2xl font-bold">
            Start with one complete journey
          </h2>
          <ol className="mt-6 grid grid-cols-1 gap-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {journey.map((item) => (
              <li key={item.step} className="min-w-0 border-t border-line pt-4">
                <p className="flex items-baseline gap-2">
                  <span className="font-mono text-xs text-accent-ink">{item.step}</span>
                  <strong className="font-semibold text-ink">{item.title}</strong>
                </p>
                <p className="mt-2 leading-relaxed text-ink-muted">{item.text}</p>
                <div className="mt-3">
                  <DemoSignIn accountRole={item.account} next={item.next} className={arrowLink}>
                    {item.action}
                    <ArrowRightIcon aria-hidden className="size-3.5" />
                  </DemoSignIn>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <section aria-labelledby="owner-features" className="mt-12">
          <h2 id="owner-features" className="font-display text-2xl font-bold">
            Everything in the owner app
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Open the owner app above, then use these links to explore with the same account.
          </p>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ownerFeatures.map((feature) => (
              <article key={feature.title} className={`${panel} flex flex-col`}>
                <h3 className="text-base font-semibold text-ink">{feature.title}</h3>
                <p className="mt-2 grow text-sm leading-relaxed text-ink-muted">{feature.text}</p>
                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
                  {feature.links.map(([label, href]) => (
                    <Link key={href} href={href ?? '/dashboard'} className={arrowLink}>
                      {label}
                      <ArrowRightIcon aria-hidden className="size-3.5" />
                    </Link>
                  ))}
                </div>
              </article>
            ))}
            <article className="flex min-w-0 flex-col rounded-panel border border-accent-line bg-accent-soft p-6">
              <h3 className="text-base font-semibold text-ink">Photo & video shorts preview</h3>
              <p className="mt-2 grow text-sm leading-relaxed text-ink-muted">
                Choose photos or a video clip, select an editing style, review a sample storyboard,
                and save a draft in the workflow preview.
              </p>
              <div className="mt-5">
                <Link href="/demo/workflow#owner/shorts" className={arrowLink}>
                  Try simulated shorts editing
                  <ArrowRightIcon aria-hidden className="size-3.5" />
                </Link>
              </div>
            </article>
          </div>
        </section>
        <section className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2">
          <article className={panel}>
            <h2 className="font-display text-xl font-bold">Two ways to accept bookings</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Suds Auto Detailing confirms available times immediately. Ridge Detail Co. asks for
              owner approval. A pending Ridge request is already waiting for you. Use the business
              selector in the owner sidebar to switch to Ridge, then open Booking requests and
              accept or decline it.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
              <DemoSignIn accountRole="customer" next="/b/suds-detailing" className={arrowLink}>
                Instant booking
                <ArrowRightIcon aria-hidden className="size-3.5" />
              </DemoSignIn>
              <DemoSignIn accountRole="customer" next="/b/ridge-detail-demo" className={arrowLink}>
                Request approval
                <ArrowRightIcon aria-hidden className="size-3.5" />
              </DemoSignIn>
            </div>
          </article>
          <article className={panel}>
            <h2 className="font-display text-xl font-bold">Accounts, invitations & email</h2>
            <p className="mt-3 text-sm leading-relaxed text-ink-muted">
              Try a new owner or customer signup, verify the account from the demo inbox, recover a
              password, or invite a teammate or an existing customer. The inbox shows queued email
              and lets you open its local confirmation links.
            </p>
            <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
              <Link href="/signup" className={arrowLink}>
                Create account
                <ArrowRightIcon aria-hidden className="size-3.5" />
              </Link>
              <Link href="/recover" className={arrowLink}>
                Password recovery
                <ArrowRightIcon aria-hidden className="size-3.5" />
              </Link>
              <Link href="/demo/inbox" className={arrowLink}>
                Open demo inbox
                <ArrowRightIcon aria-hidden className="size-3.5" />
              </Link>
            </div>
          </article>
        </section>
        <details className={`${panel} mt-8 p-5 text-sm`}>
          <summary className="cursor-pointer font-semibold text-ink">Demo login details</summary>
          <p className="mt-3 text-ink-muted">
            The buttons sign in normally with fictional accounts. Shared demo password:{' '}
            <code className="font-mono text-ink">{DEMO_PASSWORD}</code>.
          </p>
          <ul className="mt-3 space-y-2 text-ink">
            {Object.values(DEMO_ACCOUNTS).map((account) => (
              <li key={account.email} className="break-words">
                {account.name}: <code className="font-mono">{account.email}</code>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-ink-muted">
            Switching views changes the account in this browser. Use separate browser profiles or an
            incognito window to keep owner and customer views open together.
          </p>
        </details>
      </div>
    </main>
  )
}
