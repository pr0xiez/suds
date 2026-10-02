import Image from 'next/image'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Logo } from '@/components/Logo'
import polish from '@/public/landing/polish.jpg'

/**
 * Sign-in, sign-up, verification and recovery. Form column on the left; on
 * large screens a photo panel fills the right half.
 */
export function AccountFrame({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
}) {
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <main className="flex flex-col px-5 py-6 sm:px-10 lg:px-16">
        <Link href="/" aria-label="Suds home" className="inline-flex self-start">
          <Logo />
        </Link>
        <div className="flex flex-1 items-center py-12">
          <div className="mx-auto w-full max-w-sm animate-rise">
            <h1 className="font-display text-3xl font-bold leading-tight text-ink">{title}</h1>
            {subtitle ? <p className="mt-2 text-sm text-ink-muted">{subtitle}</p> : null}
            <div className="mt-8 space-y-5">{children}</div>
          </div>
        </div>
      </main>
      <div className="relative hidden p-3 lg:block">
        <div className="relative h-full overflow-hidden rounded-[1.25rem] bg-chrome">
          <Image
            src={polish}
            alt="A detailer machine-polishing the hood of a black car"
            fill
            priority
            sizes="50vw"
            placeholder="blur"
            className="object-cover object-[50%_30%]"
          />
        </div>
      </div>
    </div>
  )
}
