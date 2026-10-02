'use client'
import type { Icon } from '@phosphor-icons/react'
import {
  ArrowRightIcon,
  CalendarPlusIcon,
  CameraIcon,
  CheckIcon,
  CopyIcon,
  FilmSlateIcon,
  FloppyDiskIcon,
  HandWavingIcon,
  InfoIcon,
  MagicWandIcon,
  NotePencilIcon,
  WarningIcon,
} from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import {
  Badge,
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  Field,
  hintClass,
  labelClass,
  linkClass,
  selectClass,
  type Tone,
  textareaClass,
} from '@/components/ui'

type Run = {
  id: string
  status: string
  error: string | null
  output: { title?: string; caption?: string; hashtags?: string[]; reviewNotes?: string }
}

const TASKS: Array<[string, string, Icon]> = [
  ['job', 'Show a completed detail', CameraIcon],
  ['slots', 'Fill available times', CalendarPlusIcon],
  ['intro', 'Introduce my business', HandWavingIcon],
]

const RUN_STATUS: Record<string, { label: string; tone: Tone }> = {
  QUEUED: { label: 'Queued', tone: 'info' },
  SUBMITTING: { label: 'Preparing', tone: 'warn' },
  PROCESSING: { label: 'Preparing', tone: 'warn' },
  COMPLETED: { label: 'Ready', tone: 'ok' },
  FAILED: { label: 'Failed', tone: 'danger' },
  UNCERTAIN: { label: 'Needs review', tone: 'warn' },
}

function runStatus(status: string) {
  return RUN_STATUS[status] ?? { label: status.toLowerCase(), tone: 'neutral' as Tone }
}

/** Inline notice inside a card: smaller than a page-level Callout. */
function Notice({
  tone,
  icon: NoticeIcon,
  children,
}: {
  tone: 'info' | 'warn'
  icon: Icon
  children: React.ReactNode
}) {
  return (
    <div
      className={clsx(
        'mb-5 flex items-start gap-2.5 rounded-control border px-3 py-2.5 text-sm text-ink',
        tone === 'warn' ? 'border-warn-line bg-warn-soft' : 'border-info-line bg-info-soft',
      )}
    >
      <NoticeIcon
        aria-hidden
        className={clsx('mt-0.5 size-4 shrink-0', tone === 'warn' ? 'text-warn' : 'text-info')}
      />
      <p className="min-w-0">{children}</p>
    </div>
  )
}

/** Pair with a background (bg-surface-2 or bg-surface); checked switches it to the accent. */
const consentBox =
  'flex cursor-pointer items-start gap-3 rounded-control border border-line p-3 text-sm text-ink has-[:checked]:border-accent-line has-[:checked]:bg-accent-soft'

export function MarketingAssistant({
  demo = false,
  configured,
  jobs,
  services,
  photos,
  initialTask,
}: {
  demo?: boolean
  initialTask?: string
  configured: boolean
  jobs: { id: string; label: string }[]
  services: { id: string; label: string }[]
  photos: { id: string; label: string }[]
}) {
  const router = useRouter()
  const [task, setTask] = useState(
    ['job', 'slots', 'intro'].includes(initialTask ?? '') ? (initialTask as string) : 'job',
  )
  const [photoIds, setPhotoIds] = useState<string[]>([])
  const [runs, setRuns] = useState<Run[]>([])
  const [selected, setSelected] = useState('')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [retryKey, setRetryKey] = useState('')
  const [approved, setApproved] = useState(false)
  const run = runs.find((item) => item.id === selected) ?? runs[0]
  useEffect(() => {
    if (busy) return
    let stopped = false
    let timer: ReturnType<typeof setTimeout>
    async function load() {
      try {
        const response = await fetch('/api/marketing')
        const data = await response.json()
        if (stopped) return
        if (!response.ok) throw new Error(data.error ?? 'Could not load drafts.')
        setRuns(data.runs)
        if (
          data.runs.some((item: Run) =>
            ['QUEUED', 'SUBMITTING', 'PROCESSING'].includes(item.status),
          )
        )
          timer = setTimeout(load, demo ? 1000 : 15_000)
      } catch (err) {
        if (!stopped) setMessage(err instanceof Error ? err.message : 'Could not load drafts.')
      }
    }
    void load()
    return () => {
      stopped = true
      clearTimeout(timer)
    }
  }, [busy, demo])
  useEffect(() => {
    setCaption(run?.id ? (run.output.caption ?? '') : '')
    setApproved(false)
  }, [run?.id, run?.output.caption])
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (busy) return
    const form = new FormData(e.currentTarget)
    const key = retryKey || crypto.randomUUID()
    setRetryKey(key)
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch('/api/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          task,
          brief: form.get('brief'),
          platform: form.get('platform'),
          voice: form.get('voice'),
          jobId: task === 'job' ? form.get('jobId') : undefined,
          serviceId: task === 'slots' ? form.get('serviceId') : undefined,
          photoIds,
          approved: form.get('consent') === 'true',
          idempotencyKey: key,
        }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not prepare this draft.')
      setRuns((list) => [data, ...list.filter((item) => item.id !== data.id)])
      setSelected(data.id)
      setRetryKey('')
      setMessage('Your draft is queued. You can return to it on any device.')
    } catch (err) {
      setMessage(
        err instanceof Error
          ? err.message
          : 'Could not confirm the request. Retry the same brief to recover the saved draft.',
      )
    } finally {
      setBusy(false)
    }
  }
  async function save(openComposer = false) {
    if (!run) return
    setBusy(true)
    setMessage('')
    try {
      const response = await fetch(`/api/marketing/${run.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not save.')
      setMessage('Caption saved.')
      if (openComposer) router.push(`/social/new?aiRunId=${encodeURIComponent(run.id)}`)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }
  async function copy() {
    if (!run || !approved) return
    setBusy(true)
    setMessage('')
    try {
      const check = await fetch(`/api/marketing/${run.id}/review`, { method: 'POST' })
      const result = await check.json()
      if (!check.ok) throw new Error(result.error ?? 'Could not check permission and availability.')
      await navigator.clipboard.writeText(
        `${caption}${run.output.hashtags?.length ? `\n\n${run.output.hashtags.join(' ')}` : ''}`,
      )
      setMessage('Caption copied. Publish it from your social account.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not copy.')
    } finally {
      setBusy(false)
    }
  }
  const status = run ? runStatus(run.status) : null
  const pendingRun = Boolean(run && run.status !== 'COMPLETED')
  const working = run ? ['QUEUED', 'SUBMITTING', 'PROCESSING'].includes(run.status) : false
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <Card title="Choose a marketing task">
        <div
          className="grid grid-cols-1 gap-2 sm:grid-cols-3"
          role="group"
          aria-label="Marketing task"
        >
          {TASKS.map(([value, label, TaskIcon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={task === value}
              className={clsx(
                'flex min-h-12 items-center gap-3 rounded-control border px-3 py-2.5 text-left text-sm font-medium transition-colors sm:flex-col sm:items-start sm:gap-2 sm:py-3',
                task === value
                  ? 'border-accent-line bg-accent-soft text-ink'
                  : 'border-line bg-surface text-ink-muted hover:border-line-strong hover:bg-surface-2 hover:text-ink',
              )}
              onClick={() => {
                setTask(value ?? 'job')
                setRetryKey('')
              }}
            >
              <TaskIcon
                aria-hidden
                className={clsx(
                  'size-5 shrink-0',
                  task === value ? 'text-accent-ink' : 'text-ink-faint',
                )}
              />
              <span className="min-w-0">{label}</span>
            </button>
          ))}
        </div>
        <p className="mt-3 mb-5 flex items-center gap-2 text-sm text-ink-muted">
          <FilmSlateIcon aria-hidden className="size-4 shrink-0 text-ink-faint" />
          <span className="min-w-0">
            Working with video?{' '}
            <Link href="/social/shorts" className={linkClass}>
              Make a short
            </Link>
          </span>
        </p>
        {!configured && (
          <Notice tone="warn" icon={WarningIcon}>
            The Suds administrator needs to connect your marketing assistant before you can prepare
            a draft.
          </Notice>
        )}
        {demo && (
          <Notice tone="info" icon={InfoIcon}>
            Demo assistant: responses use your choices and fictional business data. No paid AI
            provider is called. Saved drafts and the post composer work normally.
          </Notice>
        )}
        <form
          onSubmit={submit}
          onChangeCapture={() => setRetryKey('')}
          className="space-y-5 border-t border-line pt-5"
        >
          {task === 'job' && (
            <Field label="Completed job">
              <select name="jobId" required className={selectClass}>
                <option value="">Choose a completed job</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.label}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {task === 'slots' && (
            <Field label="Service to promote">
              <select name="serviceId" required className={selectClass}>
                {services.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.label}
                  </option>
                ))}
              </select>
              <p className={hintClass}>
                The assistant checks the next seven days against your real schedule.
              </p>
            </Field>
          )}
          <Field label="What should the post focus on?">
            <textarea
              name="brief"
              maxLength={800}
              className={textareaClass}
              placeholder={
                task === 'job'
                  ? 'Describe the result you want to highlight.'
                  : task === 'slots'
                    ? 'Who is this service for?'
                    : 'What should a new customer know about your business?'
              }
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Platform">
              <select name="platform" className={selectClass}>
                <option value="INSTAGRAM">Instagram</option>
                <option value="FACEBOOK">Facebook</option>
                <option value="TIKTOK">TikTok</option>
                <option value="GOOGLE_BUSINESS">Google Business</option>
              </select>
            </Field>
            <Field label="Voice">
              <select name="voice" className={selectClass}>
                <option value="friendly">Friendly</option>
                <option value="professional">Professional</option>
                <option value="bold">Bold</option>
              </select>
            </Field>
          </div>
          {photos.length > 0 && (
            <div>
              <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
                <p className={clsx(labelClass, 'mb-0')}>Photos</p>
                <p className="text-xs tabular-nums text-ink-muted">
                  {photoIds.length} of 8 selected
                </p>
              </div>
              <p className="mb-3 text-xs text-ink-muted">
                Optional approved photos. Customer details stay private.
              </p>
              <div className="-m-1 grid max-h-64 grid-cols-4 gap-2 overflow-y-auto p-1 sm:grid-cols-5">
                {photos.map((photo) => {
                  const index = photoIds.indexOf(photo.id)
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      aria-pressed={photoIds.includes(photo.id)}
                      className={clsx(
                        'relative overflow-hidden rounded-control bg-surface-2 transition-shadow',
                        photoIds.includes(photo.id)
                          ? 'ring-2 ring-accent-ink'
                          : 'ring-1 ring-line hover:ring-line-strong',
                      )}
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
                    >
                      <img
                        src={`/api/photos/${photo.id}`}
                        alt={photo.label}
                        className="aspect-square w-full object-cover"
                      />
                      {index >= 0 ? (
                        <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-accent text-on-accent shadow-float">
                          <CheckIcon aria-hidden className="size-3" weight="bold" />
                        </span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <label className={clsx(consentBox, 'bg-surface-2')}>
            <input
              type="checkbox"
              name="consent"
              value="true"
              required
              className="mt-0.5 size-4 shrink-0"
            />
            <span className="min-w-0">
              I approve sending this brief and these business facts to the Suds assistant.
            </span>
          </label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button type="submit" className={btnPrimary} disabled={!configured || busy}>
              <MagicWandIcon aria-hidden />
              {busy ? 'Preparing…' : 'Prepare with Suds assistant'}
            </button>
            <p className="min-w-0 text-xs text-ink-muted">
              The assistant prepares an editable draft. You approve and publish it yourself.
            </p>
          </div>
        </form>
      </Card>

      <Card title="Your saved drafts" className="lg:self-start" padded={false}>
        {message && (
          <p
            role="status"
            className="border-b border-line bg-surface-2 px-4 py-3 text-sm text-ink sm:px-5"
          >
            {message}
          </p>
        )}
        {runs.length > 0 && (
          <div className="border-b border-line p-4 sm:p-5">
            <Field label="Draft history">
              <select
                className={selectClass}
                value={run?.id ?? ''}
                onChange={(e) => setSelected(e.target.value)}
              >
                {runs.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.output.title ?? 'Marketing draft'} · {item.status.toLowerCase()}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        )}
        {!run && (
          <div className="p-4 sm:p-5">
            <EmptyState
              icon={NotePencilIcon}
              title="No drafts yet"
              hint="Prepare your first draft to see it here."
            />
          </div>
        )}
        {run && pendingRun && status && (
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={status.tone}>{status.label}</Badge>
              {run.output.title ? (
                <span className="min-w-0 text-sm font-medium text-ink">{run.output.title}</span>
              ) : null}
            </div>
            <p
              role="status"
              className={clsx(
                'text-sm',
                run.status === 'FAILED'
                  ? 'text-danger'
                  : run.status === 'UNCERTAIN'
                    ? 'text-warn'
                    : 'text-ink-muted',
              )}
            >
              {run.status === 'UNCERTAIN'
                ? 'This request needs administrator review before retrying.'
                : run.status === 'FAILED'
                  ? 'The assistant could not finish this draft.'
                  : 'The assistant is preparing your draft in the background.'}
              {run.error ? ` ${run.error}` : ''}
            </p>
            {working ? (
              <div aria-hidden className="space-y-2.5 rounded-control border border-line p-4">
                <div className="h-3 w-2/5 rounded-full bg-surface-3" />
                <div className="h-2.5 w-full rounded-full bg-surface-2" />
                <div className="h-2.5 w-11/12 rounded-full bg-surface-2" />
                <div className="h-2.5 w-4/5 rounded-full bg-surface-2" />
                <div className="h-2.5 w-3/5 rounded-full bg-surface-2" />
              </div>
            ) : null}
          </div>
        )}
        {run?.status === 'COMPLETED' && (
          <>
            <div className="space-y-4 p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 font-semibold text-ink">{run.output.title}</p>
                {status ? <Badge tone={status.tone}>{status.label}</Badge> : null}
              </div>
              <Field label="Edit your caption">
                <textarea
                  value={caption}
                  onChange={(e) => {
                    setCaption(e.target.value)
                    setApproved(false)
                  }}
                  maxLength={2200}
                  className={`${textareaClass} min-h-64`}
                />
              </Field>
              {run.output.hashtags?.length ? (
                <p className="text-sm text-accent-ink break-words">
                  {run.output.hashtags.join(' ')}
                </p>
              ) : null}
              {run.output.reviewNotes && (
                <p className="flex items-start gap-2 rounded-control bg-surface-2 px-3 py-2.5 text-sm text-ink-muted">
                  <InfoIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-faint" />
                  <span className="min-w-0">{run.output.reviewNotes}</span>
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busy || !caption.trim()}
                  onClick={() => save()}
                >
                  <FloppyDiskIcon aria-hidden />
                  Save caption
                </button>
                <button
                  type="button"
                  className={btnSecondary}
                  disabled={busy || !caption.trim()}
                  onClick={() => save(true)}
                >
                  Save and open post composer
                  <ArrowRightIcon aria-hidden />
                </button>
              </div>
            </div>
            <div className="space-y-4 border-t border-line bg-surface-2/50 p-4 sm:p-5">
              <label className={clsx(consentBox, 'bg-surface')}>
                <input
                  type="checkbox"
                  checked={approved}
                  onChange={(e) => setApproved(e.target.checked)}
                  className="mt-0.5 size-4 shrink-0"
                />
                <span className="min-w-0">
                  I reviewed the claims, photo permissions, and caption before posting.
                </span>
              </label>
              <button
                type="button"
                className={clsx(btnPrimary, 'w-full sm:w-auto')}
                disabled={!approved || busy || !caption.trim()}
                onClick={copy}
              >
                <CopyIcon aria-hidden />
                Check availability and copy caption
              </button>
              <p className="text-xs text-ink-muted">
                Availability and photo permission are checked again before copying. Nothing
                publishes or messages customers automatically.
              </p>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
