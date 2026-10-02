import { CheckCircleIcon, WarningCircleIcon } from '@phosphor-icons/react/ssr'

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-control border border-danger-line bg-danger-soft px-3 py-2.5 text-sm text-danger"
    >
      <WarningCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  )
}

export function SuccessBanner({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p
      role="status"
      className="mb-4 flex items-start gap-2 rounded-control border border-ok-line bg-ok-soft px-3 py-2.5 text-sm text-ok"
    >
      <CheckCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </p>
  )
}
