'use client'
import { UploadSimpleIcon } from '@phosphor-icons/react/ssr'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { btnPrimary, Field, selectClass } from '@/components/ui'
import { uploadDirectMedia } from '@/lib/media/clientUpload'

/** File inputs: the native picker button restyled as a quiet secondary control. */
const fileInputClass =
  'block min-h-10 w-full cursor-pointer rounded-control border border-line-strong bg-surface px-1 py-1 text-sm text-ink-muted transition-colors hover:border-ink-faint focus:border-focus focus:outline-none focus:ring-3 focus:ring-focus/20 file:mr-3 file:cursor-pointer file:rounded-[0.5rem] file:border-0 file:bg-surface-2 file:px-3 file:py-1 file:text-sm file:font-medium file:text-ink hover:file:bg-surface-3'

export function MediaUploader({ jobId }: { jobId?: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const data = new FormData(form)
    setBusy(true)
    setMessage('')
    let added = 0
    try {
      for (const file of data.getAll('files')) {
        if (!(file instanceof File) || !file.size) continue
        await uploadDirectMedia(file, {
          kind: 'PHOTO',
          jobId,
          photoKind: String(data.get('kind')),
          approvedForMarketing: data.get('approved') === 'true',
        })
        added++
      }
      setMessage(`${added} photo${added === 1 ? '' : 's'} added.`)
      form.reset()
      router.refresh()
    } catch (err) {
      setMessage(
        `${added ? `${added} photos added. ` : ''}${err instanceof Error ? err.message : 'Upload failed.'}`,
      )
      if (added) router.refresh()
    } finally {
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
        <Field label="Photos" hint="JPEG, PNG, WebP, or GIF. Up to 10 MB per photo.">
          <input
            name="files"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            multiple
            required
            className={fileInputClass}
          />
        </Field>
        <Field label="Photo kind">
          <select name="kind" className={selectClass}>
            <option value="OTHER">Other</option>
            <option value="BEFORE">Before</option>
            <option value="AFTER">After</option>
          </select>
        </Field>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-control border border-line bg-surface-2 p-3 text-sm text-ink has-[:checked]:border-accent-line has-[:checked]:bg-accent-soft">
        <input name="approved" value="true" type="checkbox" className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0">
          I have permission to use these photos for marketing.
          <span className="mt-0.5 block text-xs text-ink-muted">
            Leave this unchecked to keep them private.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className={btnPrimary} disabled={busy}>
          <UploadSimpleIcon aria-hidden />
          {busy ? 'Uploading…' : 'Add photos'}
        </button>
        {message && (
          <p role="status" className="min-w-0 text-sm text-ink-muted">
            {message}
          </p>
        )}
      </div>
    </form>
  )
}
