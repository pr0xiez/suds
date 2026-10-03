'use client'

import { type FormEvent, startTransition, useActionState, useEffect, useRef, useState } from 'react'

/**
 * useActionState for a form whose fields must survive a failed submit.
 *
 * React resets a form after its action runs, even when the action returns an error, which wipes
 * what was typed (and leaves controlled fields out of step with their state). Submitting from
 * onSubmit inside a transition skips that reset. Our actions redirect on success and return state
 * only on failure, so a submit that settles without new state succeeded; `resetOnSuccess` then
 * clears the fields the way React did, for forms that stay on screen after saving.
 */
export function useActionForm<State>(
  action: (state: Awaited<State>, payload: FormData) => State | Promise<State>,
  initialState: Awaited<State>,
  { resetOnSuccess = false }: { resetOnSuccess?: boolean } = {},
) {
  const [state, formAction, pending] = useActionState(action, initialState)
  const formRef = useRef<HTMLFormElement>(null)
  const submitted = useRef<{ from: Awaited<State>; started: boolean } | null>(null)
  const [succeeded, setSucceeded] = useState(false)

  useEffect(() => {
    const submit = submitted.current
    if (!submit) return
    if (pending) {
      submit.started = true
      return
    }
    if (!submit.started) return
    submitted.current = null
    if (state === submit.from) {
      setSucceeded(true)
      if (resetOnSuccess) formRef.current?.reset()
    }
  }, [pending, state, resetOnSuccess])

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const { submitter } = event.nativeEvent as SubmitEvent
    const payload = new FormData(event.currentTarget, submitter)
    submitted.current = { from: state, started: false }
    setSucceeded(false)
    startTransition(() => formAction(payload))
  }

  return { state, formAction, pending, formRef, onSubmit, succeeded }
}
