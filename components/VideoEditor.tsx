'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { btnPrimary, btnSecondary, Card, Field, inputClass, selectClass } from '@/components/ui'
import { VideoSources } from '@/components/VideoSources'
import { uploadDirectMedia } from '@/lib/media/clientUpload'
import type { VideoProject } from '@/lib/videoEditing'

type Run = {
  id: string
  kind: string
  status: string
  error: string | null
  createdAt: string
  project: VideoProject
}
export function VideoEditor({
  configured,
  photosConfigured,
  photos,
  userId,
}: {
  configured: boolean
  photosConfigured: boolean
  photos: { id: string; label: string }[]
  userId: string
}) {
  const [runs, setRuns] = useState<Run[]>([])
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [mode, setMode] = useState('video')
  const [photoIds, setPhotoIds] = useState<string[]>([])
  const [retryKey, setRetryKey] = useState('')
  const [uploaded, setUploaded] = useState<{ file: File; id: string } | null>(null)
  const run = runs.find((item) => item.id === selected) ?? runs[0]
  const project = run?.project
  useEffect(() => {
    if (!userId || busy) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        const response = await fetch('/api/video-edits')
        const data = await response.json()
        if (stopped) return
        if (!response.ok) {
          setError(data.error ?? 'Could not load your edit history.')
          return
        }
        setRuns(data.runs)
        if (
          data.runs.some((item: Run) =>
            ['QUEUED', 'SUBMITTING', 'PROCESSING'].includes(item.status),
          )
        )
          timer = setTimeout(load, 15_000)
      } catch {
        if (!stopped) setError('Could not load edits. Reload to resume.')
      }
    }
    void load()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [userId, busy])
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    setReviewed(false)
    const form = new FormData(event.currentTarget)
    const key = retryKey || crypto.randomUUID()
    setRetryKey(key)
    try {
      let uploadId: string | undefined
      if (mode === 'video') {
        const file = form.get('file')
        if (!(file instanceof File) || !file.size) throw new Error('Select a video.')
        if (file.size > 50 * 1024 * 1024) throw new Error('Choose a video smaller than 50 MB.')
        if (
          uploaded &&
          uploaded.file.name === file.name &&
          uploaded.file.size === file.size &&
          uploaded.file.lastModified === file.lastModified
        )
          uploadId = uploaded.id
        else {
          const result = await uploadDirectMedia(file, {
            kind: 'VIDEO',
            approvedForMarketing: true,
          })
          uploadId = result.id
          setUploaded({ file, id: result.id })
        }
      }
      const response = await fetch('/api/video-edits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          title: form.get('title'),
          style: form.get('style') ?? 'kelly',
          uploadId,
          photoIds,
          approved: form.get('approved') === 'true',
          idempotencyKey: key,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not queue the edit.')
      setRuns((list) => [data, ...list.filter((item) => item.id !== data.id)])
      setSelected(data.id)
      setRetryKey('')
      setUploaded(null)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not confirm the request. Retry with the same brief to recover your saved request.',
      )
    } finally {
      setBusy(false)
    }
  }
  async function resume() {
    if (!run) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch(`/api/video-edits/${run.id}/retry`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not resume this edit.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resume this edit.')
    } finally {
      setBusy(false)
    }
  }
  const processing = Boolean(run && ['QUEUED', 'SUBMITTING', 'PROCESSING'].includes(run.status))
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Your source">
        <div className="mb-4 flex gap-2" role="group" aria-label="Short source">
          <button
            type="button"
            className={mode === 'video' ? btnPrimary : btnSecondary}
            aria-pressed={mode === 'video'}
            onClick={() => {
              setMode('video')
              setRetryKey('')
            }}
          >
            Video clip
          </button>
          <button
            type="button"
            className={mode === 'photos' ? btnPrimary : btnSecondary}
            aria-pressed={mode === 'photos'}
            onClick={() => {
              setMode('photos')
              setRetryKey('')
            }}
          >
            Job photos
          </button>
        </div>
        {!(mode === 'photos' ? photosConfigured : configured) && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            This editing connection is not enabled. Ask the Suds administrator to connect editing
            and media storage.
          </p>
        )}
        <form onSubmit={submit} className="space-y-4">
          <Field label="Post title">
            <input
              name="title"
              required
              maxLength={100}
              className={inputClass}
              placeholder="A fresh start for this interior"
            />
          </Field>
          {mode === 'video' ? (
            <>
              <Field label="Video clip">
                <input
                  name="file"
                  type="file"
                  accept="video/mp4,video/quicktime,.mp4,.mov"
                  required
                  className={inputClass}
                  onChange={() => {
                    setRetryKey('')
                    setUploaded(null)
                  }}
                />
                <p className="text-xs text-slate-500">
                  MP4 or MOV, up to 50 MB. Start with a short vertical clip.
                </p>
              </Field>
              <Field label="Editing style">
                <select name="style" className={selectClass}>
                  <option value="kelly">Clean and minimal</option>
                  <option value="karl">Modern and punchy</option>
                  <option value="ella">Bold and dynamic</option>
                </select>
              </Field>
            </>
          ) : (
            <div>
              <p className="mb-2 text-sm text-slate-500">
                Choose 2–8 approved photos in the order they should appear. Each plays for four
                seconds.
              </p>
              <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    aria-pressed={photoIds.includes(photo.id)}
                    onClick={() => {
                      setRetryKey('')
                      setPhotoIds((ids) =>
                        ids.includes(photo.id)
                          ? ids.filter((id) => id !== photo.id)
                          : ids.length < 8
                            ? [...ids, photo.id]
                            : ids,
                      )
                    }}
                    className="relative overflow-hidden rounded-lg border-2 border-slate-200"
                  >
                    <img
                      src={`/api/photos/${photo.id}`}
                      alt={photo.label}
                      className="aspect-square w-full object-cover"
                    />
                    {photoIds.includes(photo.id) && (
                      <span className="absolute right-1 top-1 rounded-full bg-cyan-700 px-2 text-white">
                        {photoIds.indexOf(photo.id) + 1}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {!photos.length && (
                <p className="text-sm text-slate-500">
                  Approve job or library photos for marketing to make your first short.
                </p>
              )}
            </div>
          )}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="approved" value="true" required />
            <span>I have permission to use this footage and send it to the AI editor.</span>
          </label>
          <button
            type="submit"
            className={btnPrimary}
            disabled={
              !(mode === 'photos' ? photosConfigured : configured) ||
              busy ||
              processing ||
              run?.status === 'UNCERTAIN' ||
              (mode === 'photos' && photoIds.length < 2)
            }
          >
            {busy
              ? 'Uploading and preparing…'
              : mode === 'photos'
                ? 'Create photo short'
                : 'Auto-edit my short'}
          </button>
          <p className="text-xs text-slate-500">
            AI edits use the connected account’s credits. Your edit continues in the background and
            is saved in your business history. Review before posting.
          </p>
        </form>
      </Card>
      <Card title="Review your edits">
        {error && (
          <p role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </p>
        )}
        {runs.length > 0 && (
          <Field label="Saved edits">
            <select
              className={selectClass}
              value={run?.id ?? ''}
              onChange={(e) => {
                setSelected(e.target.value)
                setReviewed(false)
              }}
            >
              {runs.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.project.title} · {item.status.toLowerCase()}
                </option>
              ))}
            </select>
          </Field>
        )}
        {!project && (
          <p className="text-sm text-slate-500">Your saved edited clips will appear here.</p>
        )}
        {project && (
          <div className="mt-4 space-y-4">
            <p className="font-medium">{project.title}</p>
            <p role="status" className="text-sm text-slate-500">
              {run?.status === 'UNCERTAIN'
                ? 'The provider submission needs administrator review before another attempt.'
                : project.status === 'failed'
                  ? 'The editor could not finish this clip.'
                  : project.status === 'completed'
                    ? 'Edit complete. Review it before downloading.'
                    : run?.status === 'QUEUED'
                      ? 'Queued for editing. You can leave this page.'
                      : 'AI editing in progress. You can return on any device.'}
            </p>
            {run?.error && <p className="text-sm text-rose-800">{run.error}</p>}
            {run?.status === 'FAILED' && (
              <button type="button" className={btnSecondary} disabled={busy} onClick={resume}>
                Resume saved edit
              </button>
            )}
            {project.status === 'completed' && project.directUrl && (
              <video
                controls
                playsInline
                src={project.directUrl}
                className="max-h-[32rem] w-full rounded-lg bg-black"
              >
                <track kind="captions" />
              </video>
            )}
            {project.status === 'completed' && (
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                />
                I reviewed this short and approve it for my post.
              </label>
            )}
            {reviewed && project.status === 'completed' && project.downloadUrl && (
              <div className="flex flex-wrap gap-2">
                <a
                  href={project.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={btnPrimary}
                >
                  Download edited short
                </a>
                <Link href="/marketing" className={btnSecondary}>
                  Prepare the caption
                </Link>
              </div>
            )}
            <p className="text-xs text-slate-500">
              Download and publish from your social account. Editing does not publish your video.
            </p>
          </div>
        )}
      </Card>
      <div className="lg:col-span-2">
        <VideoSources />
      </div>
    </div>
  )
}
