import Link from 'next/link'
import { notFound } from 'next/navigation'
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
    <main className="mx-auto max-w-4xl px-5 py-10 pb-28">
      <Link href="/demo" className="text-sm font-semibold text-emerald-700">
        ← Demo tour
      </Link>
      <h1 className="mt-6 text-3xl font-bold">Demo inbox</h1>
      <p className="mt-3 text-sm text-slate-600">
        Queued email from fictional demo accounts. Nothing is sent. Refresh after booking, signup,
        recovery, or an invitation to see its message.
      </p>
      <div className="mt-6 space-y-4">
        {!messages.length && <p>No messages yet. Create an account or book an appointment.</p>}
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
            <article key={message.id} className="rounded-2xl border border-slate-200 bg-white p-5">
              <p className="text-xs text-slate-500">
                To: {message.to} · {message.status.toLowerCase()} ·{' '}
                {message.createdAt.toLocaleString('en-US', { timeZone: 'America/New_York' })}
              </p>
              <h2 className="mt-2 font-bold">{message.subject}</h2>
              <pre className="mt-4 whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-slate-600">
                {message.text}
              </pre>
              {links.map((url) => (
                <a
                  key={url.href}
                  href={`${url.pathname}${url.search}`}
                  className="mt-4 inline-block rounded-lg bg-emerald-900 px-4 py-2 text-sm font-semibold text-white"
                >
                  Open{' '}
                  {url.pathname.includes('reset')
                    ? 'password reset'
                    : url.pathname.includes('verify')
                      ? 'confirmation'
                      : 'local demo'}{' '}
                  link →
                </a>
              ))}
            </article>
          )
        })}
      </div>
    </main>
  )
}
