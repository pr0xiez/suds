'use client'

import { WarningCircleIcon } from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import { useActionState } from 'react'
import type { BookingFormState } from '@/app/actions/bookings'

import { bookingButton } from '@/components/bookingStyles'
import { btnDanger } from '@/components/ui'

const bookingDangerButton = clsx(btnDanger, 'min-h-11! px-5!')

export function BookingActionForm({
  action,
  children,
  label,
  className = 'space-y-4',
  danger = false,
  icon,
  submitClassName,
}: {
  action: (previous: BookingFormState, fd: FormData) => Promise<BookingFormState>
  children: React.ReactNode
  label: string
  className?: string
  danger?: boolean
  /** Optional icon shown before the label (hidden while saving). */
  icon?: React.ReactNode
  /** Replaces the default submit button classes, e.g. btnPrimary on owner pages. */
  submitClassName?: string
}) {
  const [state, formAction, pending] = useActionState(action, { error: '' })
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error ? (
        <p
          role="alert"
          className="flex items-start gap-2 rounded-control border border-danger-line bg-danger-soft px-3 py-2.5 text-sm text-danger"
        >
          <WarningCircleIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
          <span>{state.error}</span>
        </p>
      ) : null}
      <button
        disabled={pending}
        type="submit"
        className={submitClassName ?? (danger ? bookingDangerButton : bookingButton)}
      >
        {pending ? null : icon}
        {pending ? 'Saving…' : label}
      </button>
    </form>
  )
}
