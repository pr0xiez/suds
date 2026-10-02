import { ArrowLeftIcon } from '@phosphor-icons/react/ssr'
import Link from 'next/link'
import { LogoMark } from '@/components/Logo'
import { btnSecondary } from '@/components/ui'

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 text-center text-ink">
      <span className="grid size-16 place-items-center rounded-full bg-accent-soft text-accent-ink">
        <LogoMark className="size-9" />
      </span>
      <h1 className="mt-6 font-display text-3xl font-bold leading-tight text-balance">
        That page washed away
      </h1>
      <Link href="/dashboard" className={`${btnSecondary} mt-8`}>
        <ArrowLeftIcon aria-hidden />
        Back to the dashboard
      </Link>
    </main>
  )
}
