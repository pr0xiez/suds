'use client'
import { useState } from 'react'
import { btnSecondary, btnSmall } from '@/components/ui'
export function PhotoApproval({ id, approved }: { id: string; approved: boolean }) {
  const [value, setValue] = useState(approved)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function change() {
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/photos/${id}/approval`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved: !value }),
      })
      if (!response.ok) throw new Error('Could not update permission.')
      setValue(!value)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update permission.')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div>
      <button
        type="button"
        className={`${btnSecondary} ${btnSmall}`}
        disabled={busy}
        aria-pressed={value}
        onClick={change}
      >
        {value ? 'Marketing approved · revoke' : 'Approve for marketing'}
      </button>
      {error && (
        <p role="alert" className="text-xs text-rose-800">
          {error}
        </p>
      )}
    </div>
  )
}
