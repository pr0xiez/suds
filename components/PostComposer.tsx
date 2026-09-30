'use client'

import clsx from 'clsx'
import Link from 'next/link'
import { useActionState, useState } from 'react'
import { type FormState, savePostAction } from '@/app/actions/social'
import { ErrorBanner } from '@/components/banners'
import {
  btnPrimary,
  btnSecondary,
  btnSmall,
  Card,
  Field,
  inputClass,
  labelClass,
  PHOTO_KIND_META,
  PLATFORM_META,
  selectClass,
} from '@/components/ui'
import { CAPTION_MAX, renderCaptionTemplate, withHashtags } from '@/lib/captions'

export interface ComposerPhoto {
  id: string
  kind: 'BEFORE' | 'AFTER' | 'OTHER'
  label: string
}

export interface ComposerTemplate {
  id: string
  name: string
  body: string
}

export interface ComposerInitial {
  postId: string
  caption: string
  platforms: string[]
  scheduledFor: string
  jobId: string
  photoIds: string[]
}

const ALL_PLATFORMS = ['INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'GOOGLE_BUSINESS'] as const
const KIND_FILTERS = ['ALL', 'AFTER', 'BEFORE', 'OTHER'] as const

export function PostComposer({
  photos,
  templates,
  templateContext,
  hashtags,
  initial,
}: {
  photos: ComposerPhoto[]
  templates: ComposerTemplate[]
  templateContext: Record<string, string>
  hashtags: string
  initial: ComposerInitial
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    savePostAction,
    null,
  )
  const [caption, setCaption] = useState(initial.caption)
  const [platforms, setPlatforms] = useState<string[]>(initial.platforms)
  const [photoIds, setPhotoIds] = useState<string[]>(initial.photoIds)
  const [templateId, setTemplateId] = useState('')
  const [kindFilter, setKindFilter] = useState<(typeof KIND_FILTERS)[number]>('ALL')

  const togglePhoto = (id: string) => {
    setPhotoIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }

  const insertTemplate = () => {
    const template = templates.find((t) => t.id === templateId)
    if (!template) return
    const rendered = renderCaptionTemplate(template.body, templateContext)
    setCaption((current) =>
      current.trim() === '' ? rendered : `${current.trimEnd()}\n\n${rendered}`,
    )
  }

  const visible = photos.filter((p) => kindFilter === 'ALL' || p.kind === kindFilter)
  const cover = photos.find((p) => p.id === photoIds[0])
  const overLimit = caption.length > CAPTION_MAX

  return (
    <form action={formAction} className="space-y-6">
      <p className="text-sm text-slate-500">
        Making a Reel or Short?{' '}
        <Link href="/social/shorts" className="font-medium text-cyan-700 underline">
          Edit a video or turn job photos into a short
        </Link>{' '}
        before publishing.
      </p>
      <input type="hidden" name="postId" value={initial.postId} />
      <input type="hidden" name="jobId" value={initial.jobId} />
      <input type="hidden" name="photoIds" value={JSON.stringify(photoIds)} />
      <ErrorBanner message={state?.error} />

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-6">
          <Card title="Caption">
            <div className="space-y-3">
              {templates.length > 0 ? (
                <div className="flex items-center gap-2">
                  <select
                    aria-label="Caption template"
                    className={`${selectClass} max-w-56`}
                    value={templateId}
                    onChange={(e) => setTemplateId(e.target.value)}
                  >
                    <option value="">Insert a template…</option>
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={insertTemplate}
                    disabled={!templateId}
                    className={`${btnSecondary} ${btnSmall}`}
                  >
                    Insert
                  </button>
                  {hashtags ? (
                    <button
                      type="button"
                      onClick={() => setCaption((c) => withHashtags(c, hashtags))}
                      className={`${btnSecondary} ${btnSmall}`}
                    >
                      + Hashtags
                    </button>
                  ) : null}
                </div>
              ) : null}
              <textarea
                name="caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write the caption…"
                className={clsx(inputClass, 'min-h-44 leading-relaxed')}
              />
              <p
                className={clsx(
                  'text-right text-xs tabular-nums',
                  overLimit ? 'font-semibold text-rose-600' : 'text-slate-400',
                )}
              >
                {caption.length.toLocaleString()} / {CAPTION_MAX.toLocaleString()}
              </p>
            </div>
          </Card>

          <Card
            title={`Photos (${photoIds.length} selected)`}
            actions={
              <span className="flex gap-1">
                {KIND_FILTERS.map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setKindFilter(filter)}
                    className={clsx(
                      'rounded-md px-2 py-1 text-xs font-medium',
                      kindFilter === filter
                        ? 'bg-slate-900 text-white'
                        : 'text-slate-500 hover:bg-slate-100',
                    )}
                  >
                    {filter === 'ALL' ? 'All' : PHOTO_KIND_META[filter].label}
                  </button>
                ))}
              </span>
            }
          >
            {photos.length === 0 ? (
              <p className="text-sm text-slate-500">
                No photos in the library yet — add some on a job page or in the Library.
              </p>
            ) : (
              <div className="grid max-h-96 grid-cols-4 gap-2 overflow-y-auto sm:grid-cols-5 md:grid-cols-6">
                {visible.map((photo) => {
                  const index = photoIds.indexOf(photo.id)
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => togglePhoto(photo.id)}
                      title={photo.label}
                      className={clsx(
                        'relative overflow-hidden rounded-lg border-2',
                        index >= 0
                          ? 'border-cyan-600'
                          : 'border-transparent hover:border-slate-300',
                      )}
                    >
                      <img
                        src={`/api/photos/${photo.id}`}
                        alt={photo.label}
                        loading="lazy"
                        className="aspect-square w-full object-cover"
                      />
                      {index >= 0 ? (
                        <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-cyan-600 text-[10px] font-bold text-white">
                          {index + 1}
                        </span>
                      ) : null}
                      <span className="absolute bottom-1 left-1 rounded bg-black/50 px-1 text-[9px] font-semibold uppercase text-white">
                        {PHOTO_KIND_META[photo.kind].label}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
            <p className="mt-2 text-xs text-slate-400">
              Click to select — the order you click is the carousel order; #1 is the cover.
            </p>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Publish">
            <div className="space-y-4">
              <div>
                <p className={labelClass}>Platforms</p>
                <div className="space-y-1.5">
                  {ALL_PLATFORMS.map((platform) => (
                    <label key={platform} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="platforms"
                        value={platform}
                        checked={platforms.includes(platform)}
                        onChange={() =>
                          setPlatforms((current) =>
                            current.includes(platform)
                              ? current.filter((p) => p !== platform)
                              : [...current, platform],
                          )
                        }
                        className="accent-cyan-700"
                      />
                      {PLATFORM_META[platform].label}
                    </label>
                  ))}
                </div>
              </div>
              <Field label="Scheduled for">
                <input
                  type="datetime-local"
                  name="scheduledFor"
                  defaultValue={initial.scheduledFor}
                  className={inputClass}
                />
              </Field>
              <div className="space-y-2">
                <button
                  type="submit"
                  name="intent"
                  value="schedule"
                  disabled={pending || overLimit}
                  className={`${btnPrimary} w-full`}
                >
                  {pending ? 'Saving…' : 'Schedule'}
                </button>
                <button
                  type="submit"
                  name="intent"
                  value="draft"
                  disabled={pending || overLimit}
                  className={`${btnSecondary} w-full`}
                >
                  Save as draft
                </button>
                <button
                  type="submit"
                  name="intent"
                  value="posted"
                  disabled={pending || overLimit}
                  className={`${btnSecondary} w-full`}
                >
                  Already posted — record it
                </button>
              </div>
            </div>
          </Card>

          <Card title="Preview">
            {cover ? (
              <img
                src={`/api/photos/${cover.id}`}
                alt="Cover"
                className="aspect-square w-full rounded-lg object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">
                No cover photo
              </div>
            )}
            <p className="mt-2 line-clamp-6 whitespace-pre-wrap text-xs text-slate-600">
              {caption || 'Caption preview…'}
            </p>
          </Card>
        </div>
      </div>
    </form>
  )
}
