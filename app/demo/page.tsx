import Link from 'next/link'
import { notFound } from 'next/navigation'
import { DemoSignIn } from '@/components/DemoToolbar'
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

export default function DemoPage() {
  if (!demoEnabled()) notFound()
  return (
    <main className="min-h-dvh bg-[#f6f8f2] pb-28 text-emerald-950">
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
        <header className="rounded-3xl bg-emerald-950 p-7 text-white md:p-10">
          <p className="text-xs font-bold uppercase tracking-[.25em] text-lime-200">
            Suds · interactive app demo
          </p>
          <h1 className="mt-4 max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
            From first booking to your next great post.
          </h1>
          <p className="mt-5 max-w-2xl leading-relaxed text-emerald-100">
            Try the owner workspace and a separate customer experience, with fictional jobs, photos,
            invoices, and appointments ready to explore.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <DemoSignIn
              accountRole="owner"
              className="rounded-xl bg-lime-200 px-5 py-3 font-bold text-emerald-950"
            >
              Open owner app →
            </DemoSignIn>
            <DemoSignIn
              accountRole="customer"
              className="rounded-xl border border-white/40 px-5 py-3 font-semibold"
            >
              Open customer app →
            </DemoSignIn>
            <DemoSignIn
              accountRole="staff"
              className="rounded-xl border border-white/40 px-5 py-3 font-semibold"
            >
              Try staff access
            </DemoSignIn>
          </div>
        </header>
        <p className="my-6 rounded-2xl border border-emerald-900/10 bg-white p-5 text-sm leading-relaxed">
          Bookings, jobs, payments, photo uploads, and social drafts save to a separate demo
          database. The marketing assistant uses simulated responses. Shorts rendering has an
          interactive workflow preview; live AI providers and private cloud storage are not
          connected. Email stays in the{' '}
          <Link href="/demo/inbox" className="font-semibold underline">
            demo inbox
          </Link>
          . Social publishing is a manual copy/download flow.
        </p>
        <section
          aria-labelledby="walkthrough"
          className="rounded-3xl border border-emerald-900/10 bg-white p-6 md:p-8"
        >
          <h2 id="walkthrough" className="text-2xl font-bold">
            Start with one complete journey
          </h2>
          <ol className="mt-5 grid gap-5 text-sm md:grid-cols-4">
            <li>
              <strong className="text-emerald-700">01 · Book a detail</strong>
              <p className="mt-2 text-slate-600">
                Open the customer view, choose a service and an available time, then confirm.
              </p>
              <div className="mt-3">
                <DemoSignIn
                  accountRole="customer"
                  next="/b/suds-detailing"
                  className="font-semibold underline"
                >
                  Try instant booking →
                </DemoSignIn>
              </div>
            </li>
            <li>
              <strong className="text-emerald-700">02 · Run the job</strong>
              <p className="mt-2 text-slate-600">
                Switch to owner, find the new job, update its progress, record payment, and print
                the invoice.
              </p>
              <div className="mt-3">
                <DemoSignIn accountRole="owner" next="/jobs" className="font-semibold underline">
                  Open jobs →
                </DemoSignIn>
              </div>
            </li>
            <li>
              <strong className="text-emerald-700">03 · Make a post</strong>
              <p className="mt-2 text-slate-600">
                Approve photos, choose a marketing task, prepare a sample draft, and save it in the
                content calendar.
              </p>
              <div className="mt-3">
                <DemoSignIn
                  accountRole="owner"
                  next="/marketing"
                  className="font-semibold underline"
                >
                  Try marketing →
                </DemoSignIn>
              </div>
            </li>
            <li>
              <strong className="text-emerald-700">04 · See both sides</strong>
              <p className="mt-2 text-slate-600">
                Return as the customer to see appointments, reschedule or cancel, manage vehicles,
                and view invoices.
              </p>
              <div className="mt-3">
                <DemoSignIn accountRole="customer" className="font-semibold underline">
                  Open customer portal →
                </DemoSignIn>
              </div>
            </li>
          </ol>
        </section>
        <section aria-labelledby="owner-features" className="mt-10">
          <h2 id="owner-features" className="text-2xl font-bold">
            Everything in the owner app
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Open the owner app above, then use these links to explore with the same account.
          </p>
          <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {ownerFeatures.map((feature) => (
              <article
                key={feature.title}
                className="flex flex-col rounded-2xl border border-emerald-900/10 bg-white p-6"
              >
                <h3 className="text-lg font-bold">{feature.title}</h3>
                <p className="mt-3 grow text-sm leading-relaxed text-slate-600">{feature.text}</p>
                <div className="mt-5 flex flex-wrap gap-x-4 gap-y-3 text-sm">
                  {feature.links.map(([label, href]) => (
                    <Link
                      key={href}
                      href={href ?? '/dashboard'}
                      className="font-semibold underline"
                    >
                      {label} →
                    </Link>
                  ))}
                </div>
              </article>
            ))}
            <article className="rounded-2xl bg-emerald-100 p-6">
              <h3 className="text-lg font-bold">Photo & video shorts preview</h3>
              <p className="mt-3 text-sm leading-relaxed">
                Choose photos or a video clip, select an editing style, review a sample storyboard,
                and save a draft in the workflow preview.
              </p>
              <Link
                href="/demo/workflow#owner/shorts"
                className="mt-5 inline-block text-sm font-semibold underline"
              >
                Try simulated shorts editing →
              </Link>
            </article>
          </div>
        </section>
        <section className="mt-10 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-emerald-900/10 bg-white p-6">
            <h2 className="text-xl font-bold">Two ways to accept bookings</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Suds Auto Detailing confirms available times immediately. Ridge Detail Co. asks for
              owner approval. A pending Ridge request is already waiting for you. Use the business
              selector in the owner sidebar to switch to Ridge, then open Booking requests and
              accept or decline it.
            </p>
            <div className="mt-5 flex flex-wrap gap-4 text-sm">
              <DemoSignIn
                accountRole="customer"
                next="/b/suds-detailing"
                className="font-semibold underline"
              >
                Instant booking →
              </DemoSignIn>
              <DemoSignIn
                accountRole="customer"
                next="/b/ridge-detail-demo"
                className="font-semibold underline"
              >
                Request approval →
              </DemoSignIn>
            </div>
          </article>
          <article className="rounded-2xl border border-emerald-900/10 bg-white p-6">
            <h2 className="text-xl font-bold">Accounts, invitations & email</h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Try a new owner or customer signup, verify the account from the demo inbox, recover a
              password, or invite a teammate or an existing customer. The inbox shows queued email
              and lets you open its local confirmation links.
            </p>
            <div className="mt-5 flex flex-wrap gap-4 text-sm">
              <Link href="/signup" className="font-semibold underline">
                Create account →
              </Link>
              <Link href="/recover" className="font-semibold underline">
                Password recovery →
              </Link>
              <Link href="/demo/inbox" className="font-semibold underline">
                Open demo inbox →
              </Link>
            </div>
          </article>
        </section>
        <details className="mt-8 rounded-2xl border border-emerald-900/10 bg-white p-5 text-sm">
          <summary className="cursor-pointer font-semibold">Demo login details</summary>
          <p className="mt-3 text-slate-600">
            The buttons sign in normally with fictional accounts. Shared demo password:{' '}
            <code>{DEMO_PASSWORD}</code>.
          </p>
          <ul className="mt-3 space-y-2">
            {Object.values(DEMO_ACCOUNTS).map((account) => (
              <li key={account.email}>
                {account.name}: <code>{account.email}</code>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-slate-500">
            Switching views changes the account in this browser. Use separate browser profiles or an
            incognito window to keep owner and customer views open together.
          </p>
        </details>
      </div>
    </main>
  )
}
