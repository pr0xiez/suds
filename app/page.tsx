import { ArrowRightIcon, CarProfileIcon } from '@phosphor-icons/react/ssr'
import Image from 'next/image'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Logo, LogoMark } from '@/components/Logo'
import { btnAccent, btnPrimary, btnSecondary, linkClass } from '@/components/ui'
import { getSessionUser } from '@/lib/auth/session'
import { businessUserFor } from '@/lib/business'
import hero from '@/public/landing/hero.jpg'
import interior from '@/public/landing/interior.jpg'
import polish from '@/public/landing/polish.jpg'

const signupLabel = 'Set up my business'

export default async function Home() {
  const user = await getSessionUser()
  if (user) {
    if (!user.emailVerifiedAt) redirect('/verify')
    redirect((await businessUserFor(user)) ? '/dashboard' : '/portal')
  }
  return (
    <div className="min-h-dvh bg-canvas text-ink">
      <header className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Suds home" className="inline-flex">
          <Logo />
        </Link>
        <nav aria-label="Account" className="flex items-center gap-2">
          <Link
            href="/login"
            className="px-3 py-2 text-sm font-medium text-ink-muted hover:text-ink"
          >
            Sign in
          </Link>
          <Link href="/signup" className={`${btnPrimary} max-sm:hidden`}>
            {signupLabel}
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero: headline left, the pitch and actions offset into the right column. */}
        <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 sm:pt-16 lg:px-8 lg:pt-20">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className="inline-flex animate-rise items-center gap-2 text-sm font-medium text-accent-ink">
                <LogoMark className="size-4" />
                For solo mobile detailers
              </p>
              <h1
                className="mt-5 animate-rise font-display text-[2.6rem] font-bold leading-[1.02] text-balance sm:text-6xl xl:text-7xl"
                style={{ animationDelay: '60ms' }}
              >
                Your next booking starts here.
              </h1>
            </div>
            <div className="animate-rise lg:col-span-5 lg:pb-2" style={{ animationDelay: '140ms' }}>
              <p className="max-w-md text-lg leading-relaxed text-ink-muted">
                Set up your services, let customers book online, and turn your best work into
                marketing.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link href="/signup" className={`${btnPrimary} min-h-12! px-6! text-base!`}>
                  {signupLabel}
                  <ArrowRightIcon aria-hidden />
                </Link>
                <Link href="/login" className={`${btnSecondary} min-h-12! px-6! text-base!`}>
                  Sign in
                </Link>
              </div>
            </div>
          </div>
          <div
            className="relative mt-10 aspect-[4/3] animate-rise overflow-hidden rounded-[1.25rem] bg-surface-3 sm:mt-14 sm:aspect-[2/1] lg:aspect-[12/5]"
            style={{ animationDelay: '220ms' }}
          >
            <Image
              src={hero}
              alt="A dark sedan covered in snow foam during an on-site wash"
              fill
              priority
              placeholder="blur"
              sizes="(min-width: 1280px) 1216px, 100vw"
              className="object-cover object-[62%_55%]"
            />
          </div>
        </section>

        {/* What it does: three cells, three different surfaces. */}
        <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6 sm:pt-32 lg:px-8">
          <h2 className="reveal max-w-2xl font-display text-3xl font-bold leading-tight text-balance sm:text-[2.75rem]">
            Run your detailing business from your phone.
          </h2>
          <div className="mt-10 grid grid-cols-1 gap-4 lg:grid-cols-12 lg:grid-rows-2">
            <article className="reveal relative min-h-[26rem] overflow-hidden rounded-panel bg-chrome lg:col-span-7 lg:row-span-2 lg:min-h-0">
              <Image
                src={polish}
                alt="A detailer machine-polishing the hood of a black car"
                fill
                placeholder="blur"
                sizes="(min-width: 1024px) 58vw, 100vw"
                className="object-cover object-[50%_35%]"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-chrome via-chrome/80 to-transparent p-6 pt-24 sm:p-8 sm:pt-32">
                <h3 className="font-display text-2xl font-bold text-chrome-ink">
                  Marketing from work you do
                </h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-chrome-muted">
                  Prepare campaigns from approved job photos, create shorts, and download content
                  ready for your social accounts.
                </p>
              </div>
            </article>

            <article className="reveal flex flex-col justify-between gap-10 rounded-panel bg-accent p-6 text-on-accent sm:p-8 lg:col-span-5">
              <LogoMark className="size-9" />
              <div>
                <h3 className="font-display text-2xl font-bold">A booking page of your own</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-on-accent/80">
                  Share your services and available times. Customers book through a link and manage
                  appointments in their own portal.
                </p>
              </div>
            </article>

            <article className="reveal grid overflow-hidden rounded-panel border border-line bg-surface sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:col-span-5">
              <div className="relative min-h-48">
                <Image
                  src={interior}
                  alt="A gloved hand brushing cleaner across a car dashboard"
                  fill
                  placeholder="blur"
                  sizes="(min-width: 1024px) 21vw, (min-width: 640px) 50vw, 100vw"
                  className="object-cover object-[60%_40%]"
                />
              </div>
              <div className="p-6 sm:p-7">
                <h3 className="font-display text-xl font-bold">A schedule you can trust</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-muted">
                  Keep jobs, customer vehicles, travel buffers, and blocked time together. Choose
                  instant booking or review requests first.
                </p>
              </div>
            </article>
          </div>
        </section>

        {/* Customers who land here by mistake. */}
        <section className="mx-auto max-w-7xl px-4 pt-16 sm:px-6 lg:px-8">
          <div className="reveal flex flex-col gap-3 border-y border-line py-6 sm:flex-row sm:items-center sm:gap-5">
            <CarProfileIcon aria-hidden className="size-7 shrink-0 text-accent-ink" />
            <p className="flex-1 text-ink-muted">
              <span className="font-medium text-ink">Booking a detail?</span> Open the booking link
              shared by your detailer.
            </p>
            <Link href="/login" className={`${linkClass} text-sm`}>
              Sign in to see your appointments
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
          <div className="reveal grid grid-cols-1 gap-8 rounded-[1.25rem] border border-chrome-line bg-chrome p-8 text-chrome-ink sm:p-12 lg:grid-cols-12 lg:items-end lg:p-16">
            <div className="lg:col-span-8">
              <h2 className="font-display text-3xl font-bold leading-tight text-balance sm:text-5xl">
                Your booking page, ready to share.
              </h2>
              <p className="mt-4 max-w-lg text-chrome-muted">
                Add your services, hours, and service area, then publish.
              </p>
            </div>
            <div className="lg:col-span-4 lg:justify-self-end">
              <Link href="/signup" className={`${btnAccent} min-h-12! px-6! text-base!`}>
                {signupLabel}
                <ArrowRightIcon aria-hidden />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-8 text-sm text-ink-muted sm:px-6 lg:px-8">
          <span className="inline-flex items-center gap-2">
            <LogoMark className="size-5 text-accent-ink" />
            Suds
          </span>
          <nav aria-label="Footer" className="flex gap-5">
            <Link href="/login" className="hover:text-ink">
              Sign in
            </Link>
            <Link href="/signup?kind=CUSTOMER" className="hover:text-ink">
              Customer account
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
