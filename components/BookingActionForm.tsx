'use client'

import { useActionState } from 'react'
import type { BookingFormState } from '@/app/actions/bookings'

import { bookingButton } from '@/components/bookingStyles'

export function BookingActionForm({
  action,
  children,
  label,
  className = 'space-y-4',
  danger = false,
}: {
  action: (previous: BookingFormState, fd: FormData) => Promise<BookingFormState>
  children: React.ReactNode
  label: string
  className?: string
  danger?: boolean
}) {
  const [state, formAction, pending] = useActionState(action, { error: '' })
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error ? (
        <p
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
        >
          {state.error}
        </p>
      ) : null}
      <button
        disabled={pending}
        type="submit"
        className={danger ? `${bookingButton} bg-rose-700 hover:bg-rose-800` : bookingButton}
      >
        {pending ? 'Saving…' : label}
      </button>
    </form>
  )
}
