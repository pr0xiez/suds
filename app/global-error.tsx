'use client'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body>
        <main style={{ maxWidth: 480, margin: '10vh auto', padding: 24, fontFamily: 'system-ui' }}>
          <h1>Something went wrong</h1>
          <p>Your saved work is still available. Try loading this page again.</p>
          <button type="button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  )
}
