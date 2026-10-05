'use client'
import type { Icon } from '@phosphor-icons/react'
import {
  ArrowClockwiseIcon,
  ArrowRightIcon,
  DownloadSimpleIcon,
  FilmStripIcon,
  ImagesIcon,
  MagicWandIcon,
  VideoCameraIcon,
  WarningIcon,
} from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { ErrorBanner } from '@/components/banners'
import { PhotoPicker } from '@/components/PhotoPicker'
import {
  Badge,
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  Field,
  hintClass,
  inputClass,
  selectClass,
  type Tone,
} from '@/components/ui'
import { usePolledRuns } from '@/components/usePolledRuns'
import { VideoSources } from '@/components/VideoSources'
import { isInFlight, MAX_RUN_PHOTOS, MIN_SHORT_PHOTOS } from '@/lib/aiRunStatus'
import { uploadDirectMedia } from '@/lib/media/clientUpload'
import type { VideoProject } from '@/lib/videoEditing'

const SOURCE_MODES: Array<{ value: string; label: string; detail: string; icon: Icon }> = [
  { value: 'video', label: 'Video clip', detail: 'MP4 or MOV, up to 50 MB', icon: VideoCameraIcon },
  {
    value: 'photos',
    label: 'Job photos',
    detail: `${MIN_SHORT_PHOTOS}-${MAX_RUN_PHOTOS} approved photos, four seconds each`,
    icon: ImagesIcon,
  },
]

/** The native file picker button restyled as a quiet secondary control. */
const fileInputClass =
  'block min-h-10 w-full cursor-pointer rounded-control border border-line-strong bg-surface px-1 py-1 text-sm text-ink-muted transition-colors hover:border-ink-faint focus:border-focus focus:outline-none focus:ring-3 focus:ring-focus/20 file:mr-3 file:cursor-pointer file:rounded-[0.5rem] file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-sm file:font-medium file:text-ink hover:file:bg-surface-3'

const consentBox =
  'flex cursor-pointer items-start gap-3 rounded-control border border-line bg-surface-2 p-3 text-sm text-ink has-[:checked]:border-accent-line has-[:checked]:bg-accent-soft'

function editStatus(
  runStatus: string | undefined,
  projectStatus: string,
): { label: string; tone: Tone } {
  if (runStatus === 'UNCERTAIN') return { label: 'Needs review', tone: 'warn' }
  if (projectStatus === 'failed' || runStatus === 'FAILED')
    return { label: 'Failed', tone: 'danger' }
  if (projectStatus === 'completed') return { label: 'Ready to review', tone: 'ok' }
  if (runStatus === 'QUEUED') return { label: 'Queued', tone: 'info' }
  return { label: 'Editing', tone: 'warn' }
}

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
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [reviewed, setReviewed] = useState(false)
  const [mode, setMode] = useState('video')
  const [photoIds, setPhotoIds] = useState<string[]>([])
  const [retryKey, setRetryKey] = useState('')
  const [uploaded, setUploaded] = useState<{ file: File; id: string } | null>(null)
  const {
    runs,
    setRuns,
    error: loadError,
    refresh,
  } = usePolledRuns<Run>('/api/video-edits', {
    intervalMs: 15_000,
    paused: !userId,
  })
  const run = runs.find((item) => item.id === selected) ?? runs[0]
  const project = run?.project
  useEffect(() => {
    if (loadError) setError(loadError)
  }, [loadError])
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
      refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resume this edit.')
    } finally {
      setBusy(false)
    }
  }
  const processing = Boolean(run && isInFlight(run.status))
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title="Your source">
        <div
          className="mb-5 grid grid-cols-1 gap-2 sm:grid-cols-2"
          role="group"
          aria-label="Short source"
        >
          {SOURCE_MODES.map(({ value, label, detail, icon: ModeIcon }) => (
            <button
              key={value}
              type="button"
              className={clsx(
                'flex min-h-12 items-start gap-3 rounded-control border px-3 py-3 text-left transition-colors',
                mode === value
                  ? 'border-accent-line bg-accent-soft'
                  : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2',
              )}
              aria-pressed={mode === value}
              onClick={() => {
                setMode(value)
                setRetryKey('')
              }}
            >
              <ModeIcon
                aria-hidden
                className={clsx(
                  'mt-0.5 size-5 shrink-0',
                  mode === value ? 'text-accent-ink' : 'text-ink-faint',
                )}
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-ink">{label}</span>
                <span className="mt-0.5 block text-xs text-ink-muted">{detail}</span>
              </span>
            </button>
          ))}
        </div>
        {!(mode === 'photos' ? photosConfigured : configured) && (
          <div className="mb-5 flex items-start gap-2.5 rounded-control border border-warn-line bg-warn-soft px-3 py-2.5 text-sm text-ink">
            <WarningIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
            <p className="min-w-0">
              This editing connection is not enabled. Ask the Suds administrator to connect editing
              and media storage.
            </p>
          </div>
        )}
        <form onSubmit={submit} className="space-y-5">
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
                  className={fileInputClass}
                  onChange={() => {
                    setRetryKey('')
                    setUploaded(null)
                  }}
                />
                <p className={hintClass}>
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
              <PhotoPicker
                photos={photos}
                value={photoIds}
                numbered
                gridClass="max-h-80 grid-cols-3 sm:grid-cols-4"
                onChange={(ids) => {
                  setRetryKey('')
                  setPhotoIds(ids)
                }}
                hint={`Choose ${MIN_SHORT_PHOTOS}-${MAX_RUN_PHOTOS} approved photos in the order they should appear. Each plays for four seconds.`}
              />
              {!photos.length && (
                <EmptyState
                  icon={ImagesIcon}
                  title="No approved photos yet"
                  hint="Approve job or library photos for marketing to make your first short."
                />
              )}
            </div>
          )}
          <label className={consentBox}>
            <input
              type="checkbox"
              name="approved"
              value="true"
              required
              className="mt-0.5 size-4 shrink-0"
            />
            <span className="min-w-0">
              I have permission to use this footage and send it to the AI editor.
            </span>
          </label>
          <button
            type="submit"
            className={btnPrimary}
            disabled={
              !(mode === 'photos' ? photosConfigured : configured) ||
              busy ||
              processing ||
              run?.status === 'UNCERTAIN' ||
              (mode === 'photos' && photoIds.length < MIN_SHORT_PHOTOS)
            }
          >
            <MagicWandIcon aria-hidden />
            {busy
              ? 'Uploading and preparing…'
              : mode === 'photos'
                ? 'Create photo short'
                : 'Auto-edit my short'}
          </button>
          <p className="text-xs text-ink-muted">
            AI edits use the connected account’s credits. Your edit continues in the background and
            is saved in your business history. Review before posting.
          </p>
        </form>
      </Card>
      <Card title="Review your edits" className="lg:self-start">
        <ErrorBanner message={error} />
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
          <EmptyState
            icon={FilmStripIcon}
            title="No edits yet"
            hint="Your saved edited clips will appear here."
          />
        )}
        {project && (
          <div className={clsx('space-y-4', runs.length > 0 && 'mt-5 border-t border-line pt-5')}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 font-semibold text-ink">{project.title}</p>
              <Badge tone={editStatus(run?.status, project.status).tone}>
                {editStatus(run?.status, project.status).label}
              </Badge>
            </div>
            <p role="status" className="text-sm text-ink-muted">
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
            {processing && project.status !== 'completed' && project.status !== 'failed' ? (
              <div
                aria-hidden
                className="grid aspect-video w-full place-items-center rounded-control border border-dashed border-line-strong/60 bg-surface-2 text-ink-faint"
              >
                <FilmStripIcon className="size-7" />
              </div>
            ) : null}
            {run?.error && <p className="text-sm text-danger">{run.error}</p>}
            {run?.status === 'FAILED' && (
              <button type="button" className={btnSecondary} disabled={busy} onClick={resume}>
                <ArrowClockwiseIcon aria-hidden />
                Resume saved edit
              </button>
            )}
            {project.status === 'completed' && project.directUrl && (
              <video
                controls
                playsInline
                src={project.directUrl}
                className="max-h-[32rem] w-full rounded-control bg-chrome"
              >
                <track kind="captions" />
              </video>
            )}
            {project.status === 'completed' && (
              <label className={consentBox}>
                <input
                  type="checkbox"
                  checked={reviewed}
                  onChange={(e) => setReviewed(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0"
                />
                <span className="min-w-0">I reviewed this short and approve it for my post.</span>
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
                  <DownloadSimpleIcon aria-hidden />
                  Download edited short
                </a>
                <Link href="/marketing" className={btnSecondary}>
                  Prepare the caption
                  <ArrowRightIcon aria-hidden />
                </Link>
              </div>
            )}
            <p className="text-xs text-ink-muted">
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
