'use client'

import { ArrowClockwiseIcon } from '@phosphor-icons/react/ssr'
import { LogoMark } from '@/components/Logo'
import { btnPrimary } from '@/components/ui'
import { fontVariables } from './fonts'
import './globals.css'

/** Replaces the root layout, so it brings its own document, fonts and tokens. */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="min-h-dvh font-sans antialiased">
        <title>Something went wrong</title>
        <main className="flex min-h-dvh flex-col items-center justify-center bg-canvas px-4 text-center text-ink">
          <span className="grid size-16 place-items-center rounded-full bg-surface-2 text-ink-muted">
            <LogoMark className="size-9" />
          </span>
          <h1 className="mt-6 font-display text-3xl font-bold leading-tight text-balance">
            Something went wrong
          </h1>
          <p className="mt-3 max-w-sm text-ink-muted">
            Your saved work is still available. Try loading this page again.
          </p>
          <button type="button" onClick={reset} className={`${btnPrimary} mt-8`}>
            <ArrowClockwiseIcon aria-hidden />
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
