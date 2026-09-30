'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { btnPrimary, btnSecondary, Card, Field, selectClass, textareaClass } from '@/components/ui'

type Run = {
  id: string
  status: string
  error: string | null
  output: { title?: string; caption?: string; hashtags?: string[]; reviewNotes?: string }
}
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
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card title="Choose a marketing task">
        <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Marketing task">
          {[
            ['job', 'Show a completed detail'],
            ['slots', 'Fill available times'],
            ['intro', 'Introduce my business'],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={task === value}
              className={task === value ? btnPrimary : btnSecondary}
              onClick={() => {
                setTask(value ?? 'job')
                setRetryKey('')
              }}
            >
              {label}
            </button>
          ))}
          <Link href="/social/shorts" className={btnSecondary}>
            Make a short
          </Link>
        </div>
        {!configured && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            The Suds administrator needs to connect your marketing assistant before you can prepare
            a draft.
          </p>
        )}
        {demo && (
          <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
            Demo assistant: responses use your choices and fictional business data. No paid AI
            provider is called. Saved drafts and the post composer work normally.
          </p>
        )}
        <form onSubmit={submit} onChangeCapture={() => setRetryKey('')} className="space-y-4">
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
              <p className="text-xs text-slate-500">
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
          <div className="grid gap-3 sm:grid-cols-2">
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
              <p className="mb-2 text-sm text-slate-500">
                Optional approved photos. Customer details stay private.
              </p>
              <div className="grid max-h-64 grid-cols-4 gap-2 overflow-y-auto">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    type="button"
                    aria-pressed={photoIds.includes(photo.id)}
                    className={`overflow-hidden rounded-lg border-2 ${photoIds.includes(photo.id) ? 'border-cyan-700' : 'border-slate-200'}`}
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
                  </button>
                ))}
              </div>
            </div>
          )}
          <label className="flex gap-2 text-sm">
            <input type="checkbox" name="consent" value="true" required />I approve sending this
            brief and these business facts to the Suds assistant.
          </label>
          <button type="submit" className={btnPrimary} disabled={!configured || busy}>
            {busy ? 'Preparing…' : 'Prepare with Suds assistant'}
          </button>
          <p className="text-xs text-slate-500">
            The assistant prepares an editable draft. You approve and publish it yourself.
          </p>
        </form>
      </Card>
      <Card title="Your saved drafts">
        {message && (
          <p role="status" className="mb-4 rounded-lg bg-slate-50 p-3 text-sm">
            {message}
          </p>
        )}
        {runs.length > 0 && (
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
        )}
        {!run && <p className="text-sm text-slate-500">Prepare your first draft to see it here.</p>}
        {run && run.status !== 'COMPLETED' && (
          <p role="status" className="mt-4 text-sm">
            {run.status === 'UNCERTAIN'
              ? 'This request needs administrator review before retrying.'
              : run.status === 'FAILED'
                ? 'The assistant could not finish this draft.'
                : 'The assistant is preparing your draft in the background.'}
            {run.error ? ` ${run.error}` : ''}
          </p>
        )}
        {run?.status === 'COMPLETED' && (
          <div className="mt-4 space-y-4">
            <p className="font-medium">{run.output.title}</p>
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
            {run.output.reviewNotes && (
              <p className="text-sm text-slate-500">{run.output.reviewNotes}</p>
            )}
            <button
              type="button"
              className={btnSecondary}
              disabled={busy || !caption.trim()}
              onClick={() => save()}
            >
              Save caption
            </button>
            <button
              type="button"
              className={btnSecondary}
              disabled={busy || !caption.trim()}
              onClick={() => save(true)}
            >
              Save and open post composer
            </button>
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={approved}
                onChange={(e) => setApproved(e.target.checked)}
              />
              I reviewed the claims, photo permissions, and caption before posting.
            </label>
            <button
              type="button"
              className={btnPrimary}
              disabled={!approved || busy || !caption.trim()}
              onClick={copy}
            >
              Check availability and copy caption
            </button>
            <p className="text-xs text-slate-500">
              Availability and photo permission are checked again before copying. Nothing publishes
              or messages customers automatically.
            </p>
          </div>
        )}
      </Card>
    </div>
  )
}
