import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSessionUser } from '@/lib/auth/session'
import { businessUserFor } from '@/lib/business'

export default async function Home() {
  const user = await getSessionUser()
  if (user) {
    if (!user.emailVerifiedAt) redirect('/verify')
    redirect((await businessUserFor(user)) ? '/dashboard' : '/portal')
  }
  return (
    <main className="min-h-dvh bg-emerald-950 px-5 text-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between py-6">
        <Link href="/" className="text-2xl font-bold tracking-tight">
          🫧 Suds
        </Link>
        <Link
          href="/login"
          className="rounded-full border border-white/25 px-5 py-2 text-sm font-semibold"
        >
          Sign in
        </Link>
      </header>
      <section className="mx-auto max-w-5xl py-16 sm:py-24">
        <p className="mb-5 text-sm font-semibold uppercase tracking-widest text-lime-300">
          For solo mobile detailers
        </p>
        <h1 className="max-w-3xl text-5xl font-semibold leading-tight tracking-tight sm:text-7xl">
          Your next booking starts here.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-emerald-100">
          Set up your services, let customers book online, and turn your best work into marketing.
          Run your detailing business from your phone.
        </p>
        <Link
          href="/signup"
          className="mt-8 inline-flex rounded-full bg-lime-300 px-7 py-3.5 font-bold text-emerald-950"
        >
          Set up my business →
        </Link>
        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {[
            [
              'A booking page of your own',
              'Share your services and available times. Customers book through a link and manage appointments in their own portal.',
            ],
            [
              'A schedule you can trust',
              'Keep jobs, customer vehicles, travel buffers, and blocked time together. Choose instant booking or review requests first.',
            ],
            [
              'Marketing from work you do',
              'Prepare campaigns from approved job photos, create shorts, and download content ready for your social accounts.',
            ],
          ].map(([title, text]) => (
            <article key={title} className="rounded-2xl border border-white/15 bg-white/5 p-6">
              <h2 className="text-lg font-semibold text-lime-200">{title}</h2>
              <p className="mt-3 text-sm leading-relaxed text-emerald-100">{text}</p>
            </article>
          ))}
        </div>
        <p className="mt-8 text-sm text-emerald-200">
          Booking a detail? Open the booking link shared by your detailer.
        </p>
      </section>
    </main>
  )
}
