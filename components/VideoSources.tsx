'use client'
import { useEffect, useState } from 'react'
import { btnSecondary, btnSmall, Card } from '@/components/ui'

type Source = { id: string; originalName: string; sizeBytes: number; status: string }
export function VideoSources() {
  const [sources, setSources] = useState<Source[]>([])
  const [busy, setBusy] = useState('')
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  // biome-ignore lint/correctness/useExhaustiveDependencies: revision intentionally requests a fresh read.
  useEffect(() => {
    let stopped = false
    async function load() {
      try {
        const response = await fetch('/api/media/uploads')
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'Could not load source videos.')
        if (!stopped) setSources(data.uploads)
      } catch (err) {
        if (!stopped) setMessage(err instanceof Error ? err.message : 'Could not load sources.')
      }
    }
    void load()
    return () => {
      stopped = true
    }
  }, [revision])
  async function remove(id: string) {
    setBusy(id)
    setMessage('')
    try {
      const response = await fetch(`/api/media/uploads/${id}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error ?? 'Could not delete the source.')
      setSources((list) => list.filter((item) => item.id !== id))
      setMessage('Source video deleted. Your completed edited shorts remain saved.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not delete the source.')
    } finally {
      setBusy('')
    }
  }
  return (
    <Card
      title="Uploaded source videos"
      actions={
        <button
          type="button"
          className={`${btnSecondary} ${btnSmall}`}
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh
        </button>
      }
    >
      <p className="mb-3 text-sm text-slate-500">
        Remove originals you no longer need to free storage. Completed edits are saved separately.
      </p>
      {sources.length === 0 && <p className="text-sm text-slate-500">No saved source videos.</p>}
      <ul className="divide-y divide-slate-100">
        {sources.map((source) => (
          <li key={source.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
            <span className="min-w-0 break-all text-sm">
              {source.originalName} · {(source.sizeBytes / 1024 / 1024).toFixed(1)} MB
              {source.status === 'DELETING' ? ' · cleanup pending' : ''}
            </span>
            <button
              type="button"
              disabled={!!busy}
              className={`${btnSecondary} ${btnSmall}`}
              onClick={() => remove(source.id)}
            >
              {busy === source.id ? 'Deleting…' : 'Delete source'}
            </button>
          </li>
        ))}
      </ul>
      {message && (
        <p role="status" className="mt-3 text-sm">
          {message}
        </p>
      )}
    </Card>
  )
}
