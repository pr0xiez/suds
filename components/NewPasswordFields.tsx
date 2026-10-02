'use client'

import { useRef, useState } from 'react'
import { Field, inputClass } from '@/components/ui'

const MISMATCH = 'The passwords do not match. Type the same password in both fields.'

/**
 * New password plus confirmation. The browser blocks a mismatched submit;
 * the route handler checks again, and `errors` carries what it found.
 */
export function NewPasswordFields({
  label = 'Password',
  errors = {},
}: {
  label?: string
  errors?: { password?: string; confirmPassword?: string }
}) {
  const passwordRef = useRef<HTMLInputElement>(null)
  // null until the visitor edits, so the server's findings show until then.
  const [mismatch, setMismatch] = useState<boolean | null>(null)
  const [passwordEdited, setPasswordEdited] = useState(false)

  function check(confirm: HTMLInputElement) {
    const differs = confirm.value !== '' && confirm.value !== passwordRef.current?.value
    confirm.setCustomValidity(differs ? MISMATCH : '')
    setMismatch(differs)
  }

  const passwordError = passwordEdited ? undefined : errors.password
  const confirmError = mismatch === null ? errors.confirmPassword : mismatch ? MISMATCH : undefined
  return (
    <>
      <Field label={label} hint="Use 12 to 128 characters." error={passwordError}>
        <input
          ref={passwordRef}
          name="password"
          type="password"
          minLength={12}
          maxLength={128}
          required
          autoComplete="new-password"
          aria-invalid={passwordError ? true : undefined}
          className={inputClass}
          onChange={(event) => {
            setPasswordEdited(true)
            const confirm = event.currentTarget.form?.elements.namedItem('confirmPassword')
            if (confirm instanceof HTMLInputElement) check(confirm)
          }}
        />
      </Field>
      <Field label="Confirm password" error={confirmError}>
        <input
          name="confirmPassword"
          type="password"
          maxLength={128}
          required
          autoComplete="new-password"
          aria-invalid={confirmError ? true : undefined}
          className={inputClass}
          onChange={(event) => check(event.currentTarget)}
        />
      </Field>
    </>
  )
}
