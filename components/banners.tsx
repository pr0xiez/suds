export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
      {message}
    </p>
  )
}

export function SuccessBanner({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
      {message}
    </p>
  )
}
