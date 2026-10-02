'use client'
import { ArrowClockwiseIcon, FileVideoIcon, TrashIcon } from '@phosphor-icons/react/ssr'
import { useEffect, useState } from 'react'
import { Badge, btnDanger, btnSecondary, btnSmall, Card } from '@/components/ui'

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
          <ArrowClockwiseIcon aria-hidden />
          Refresh
        </button>
      }
      padded={false}
    >
      <p className="border-b border-line px-4 py-3 text-sm text-ink-muted sm:px-5">
        Remove originals you no longer need to free storage. Completed edits are saved separately.
      </p>
      {sources.length === 0 && (
        <p className="flex items-center gap-2 px-4 py-4 text-sm text-ink-muted sm:px-5">
          <FileVideoIcon aria-hidden className="size-4 shrink-0 text-ink-faint" />
          No saved source videos.
        </p>
      )}
      <ul className="divide-y divide-line empty:hidden">
        {sources.map((source) => (
          <li
            key={source.id}
            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5"
          >
            <span className="flex min-w-0 flex-1 items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-control bg-surface-2 text-ink-faint">
                <FileVideoIcon aria-hidden className="size-5" />
              </span>
              <span className="min-w-0">
                <span className="block break-all text-sm font-medium text-ink">
                  {source.originalName}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-2 text-xs tabular-nums text-ink-muted">
                  {(source.sizeBytes / 1024 / 1024).toFixed(1)} MB
                  {source.status === 'DELETING' ? <Badge tone="warn">cleanup pending</Badge> : null}
                </span>
              </span>
            </span>
            <button
              type="button"
              disabled={!!busy}
              className={`${btnDanger} ${btnSmall}`}
              onClick={() => remove(source.id)}
            >
              <TrashIcon aria-hidden />
              {busy === source.id ? 'Deleting…' : 'Delete source'}
            </button>
          </li>
        ))}
      </ul>
      {message && (
        <p role="status" className="border-t border-line px-4 py-3 text-sm text-ink sm:px-5">
          {message}
        </p>
      )}
    </Card>
  )
}
