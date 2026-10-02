import { ArrowSquareOutIcon, EnvelopeSimpleIcon, FlaskIcon } from '@phosphor-icons/react/ssr'
import { notFound } from 'next/navigation'
import { Badge, btnPrimary, btnSmall, EmptyState, PageHeader } from '@/components/ui'
import { prisma } from '@/lib/db/client'
import { demoEnabled } from '@/lib/demo'
import { publicAppUrl } from '@/lib/notifications'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Demo inbox' }

export default async function DemoInbox() {
  if (!demoEnabled()) notFound()
  const messages = await prisma.notificationOutbox.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  const origin = new URL(publicAppUrl()).origin
  return (
    <main className="min-h-dvh bg-canvas text-ink">
      <div className="mx-auto max-w-4xl px-4 py-8 pb-32 sm:px-6 md:py-10">
        <PageHeader
          back={{ href: '/demo', label: 'Demo tour' }}
          title="Demo inbox"
          subtitle="Queued email from fictional demo accounts. Nothing is sent. Refresh after booking, signup, recovery, or an invitation to see its message."
          actions={
            <Badge tone="accent">
              <FlaskIcon aria-hidden className="size-3.5" />
              Demo only
            </Badge>
          }
        />
        <div className="space-y-4">
          {!messages.length && (
            <EmptyState
              icon={EnvelopeSimpleIcon}
              title="No messages yet. Create an account or book an appointment."
            />
          )}
          {messages.map((message) => {
            const links = [...new Set(message.text.match(/https?:\/\/[^\s]+/g) ?? [])].flatMap(
              (value) => {
                try {
                  const url = new URL(value)
                  return url.origin === origin ? [url] : []
                } catch {
                  return []
                }
              },
            )
            return (
              <article
                key={message.id}
                className="min-w-0 rounded-panel border border-line bg-surface p-5 shadow-panel"
              >
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-ink-muted">
                  <span className="min-w-0 break-all">To: {message.to}</span>
                  <Badge>{message.status.toLowerCase()}</Badge>
                  <span className="tabular-nums">
                    {message.createdAt.toLocaleString('en-US', { timeZone: 'America/New_York' })}
                  </span>
                </p>
                <h2 className="mt-2 font-semibold text-ink">{message.subject}</h2>
                <pre className="mt-4 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-ink-muted">
                  {message.text}
                </pre>
                {links.length ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {links.map((url) => (
                      <a
                        key={url.href}
                        href={`${url.pathname}${url.search}`}
                        className={`${btnPrimary} ${btnSmall}`}
                      >
                        <ArrowSquareOutIcon aria-hidden />
                        Open{' '}
                        {url.pathname.includes('reset')
                          ? 'password reset'
                          : url.pathname.includes('verify')
                            ? 'confirmation'
                            : 'local demo'}{' '}
                        link
                      </a>
                    ))}
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      </div>
    </main>
  )
}
