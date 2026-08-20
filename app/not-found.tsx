import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <p aria-hidden className="text-4xl">
        🫧
      </p>
      <h1 className="text-xl font-bold text-slate-900">That page washed away</h1>
      <Link href="/dashboard" className="text-sm font-medium text-cyan-700 hover:underline">
        Back to the dashboard
      </Link>
    </div>
  )
}
