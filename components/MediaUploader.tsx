'use client'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { btnPrimary, Field, inputClass, selectClass } from '@/components/ui'
import { uploadDirectMedia } from '@/lib/media/clientUpload'
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
    <form onSubmit={submit} className="space-y-3">
      <Field label="Photos">
        <input
          name="files"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          required
          className={inputClass}
        />
      </Field>
      <Field label="Photo kind">
        <select name="kind" className={selectClass}>
          <option value="OTHER">Other</option>
          <option value="BEFORE">Before</option>
          <option value="AFTER">After</option>
        </select>
      </Field>
      <label className="flex gap-2 text-sm">
        <input name="approved" value="true" type="checkbox" />I have permission to use these photos
        for marketing.
      </label>
      <p className="text-xs text-slate-500">JPEG, PNG, WebP, or GIF. Up to 10 MB per photo.</p>
      <button type="submit" className={btnPrimary} disabled={busy}>
        {busy ? 'Uploading…' : 'Add photos'}
      </button>
      {message && (
        <p role="status" className="text-sm">
          {message}
        </p>
      )}
    </form>
  )
}
