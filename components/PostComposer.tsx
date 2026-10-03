'use client'

import {
  CalendarCheckIcon,
  CheckIcon,
  FilmSlateIcon,
  ImageIcon,
  ImagesIcon,
  PlusIcon,
} from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import Link from 'next/link'
import { useState } from 'react'
import { type FormState, savePostAction } from '@/app/actions/social'
import { ErrorBanner } from '@/components/banners'
import {
  btnPrimary,
  btnSecondary,
  Card,
  EmptyState,
  Field,
  inputClass,
  labelClass,
  linkClass,
  PHOTO_KIND_META,
  PhotoKindBadge,
  PLATFORM_META,
  segmentClass,
  segmentTrack,
  selectClass,
  textareaClass,
} from '@/components/ui'
import { useActionForm } from '@/components/useActionForm'
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
  const { state, formAction, pending, onSubmit } = useActionForm<FormState | null>(
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
    <form action={formAction} onSubmit={onSubmit} className="space-y-6">
      <p className="flex items-start gap-2 text-sm text-ink-muted">
        <FilmSlateIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-ink-faint" />
        <span className="min-w-0">
          Making a Reel or Short?{' '}
          <Link href="/social/shorts" className={linkClass}>
            Edit a video or turn job photos into a short
          </Link>{' '}
          before publishing.
        </span>
      </p>
      <input type="hidden" name="postId" value={initial.postId} />
      <input type="hidden" name="jobId" value={initial.jobId} />
      <input type="hidden" name="photoIds" value={JSON.stringify(photoIds)} />
      <ErrorBanner message={state?.error} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="min-w-0 space-y-6">
          <Card title="Caption">
            <div className="space-y-3">
              {templates.length > 0 ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <select
                    aria-label="Caption template"
                    className={clsx(selectClass, 'sm:max-w-64')}
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
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={insertTemplate}
                      disabled={!templateId}
                      className={btnSecondary}
                    >
                      Insert
                    </button>
                    {hashtags ? (
                      <button
                        type="button"
                        onClick={() => setCaption((c) => withHashtags(c, hashtags))}
                        className={btnSecondary}
                      >
                        <PlusIcon aria-hidden />
                        Hashtags
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <textarea
                name="caption"
                aria-label="Caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Write the caption…"
                className={clsx(textareaClass, 'min-h-44')}
              />
              <p
                className={clsx(
                  'text-right text-xs tabular-nums',
                  overLimit ? 'font-semibold text-danger' : 'text-ink-faint',
                )}
              >
                {overLimit ? 'Over the limit: ' : ''}
                {caption.length.toLocaleString()} / {CAPTION_MAX.toLocaleString()}
              </p>
            </div>
          </Card>

          <Card title={`Photos (${photoIds.length} selected)`}>
            {photos.length === 0 ? (
              <EmptyState
                icon={ImagesIcon}
                title="No photos in the library yet"
                hint="Add some on a job page or in the Library, then approve them for marketing."
              />
            ) : (
              <>
                <div className="mb-3">
                  <div className={segmentTrack} role="group" aria-label="Filter photos by kind">
                    {KIND_FILTERS.map((filter) => (
                      <button
                        key={filter}
                        type="button"
                        aria-pressed={kindFilter === filter}
                        onClick={() => setKindFilter(filter)}
                        className={segmentClass(kindFilter === filter)}
                      >
                        {filter === 'ALL' ? 'All' : PHOTO_KIND_META[filter].label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="-m-1 grid max-h-96 grid-cols-3 gap-2 overflow-y-auto p-1 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6">
                  {visible.map((photo) => {
                    const index = photoIds.indexOf(photo.id)
                    return (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => togglePhoto(photo.id)}
                        title={photo.label}
                        aria-pressed={index >= 0}
                        className={clsx(
                          'relative overflow-hidden rounded-control bg-surface-2 transition-shadow',
                          index >= 0
                            ? 'ring-2 ring-accent-ink'
                            : 'ring-1 ring-line hover:ring-line-strong',
                        )}
                      >
                        <img
                          src={`/api/photos/${photo.id}`}
                          alt={photo.label}
                          loading="lazy"
                          className="aspect-square w-full object-cover"
                        />
                        {index >= 0 ? (
                          <span className="absolute right-1.5 top-1.5 grid size-6 place-items-center rounded-full bg-accent text-xs font-bold tabular-nums text-on-accent shadow-float">
                            {index + 1}
                          </span>
                        ) : null}
                        <span className="absolute bottom-1.5 left-1.5">
                          <PhotoKindBadge kind={photo.kind} />
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            <p className="mt-3 text-xs text-ink-muted">
              Click to select. The order you click is the carousel order, and #1 is the cover.
            </p>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card title="Publish">
            <div className="space-y-5">
              <fieldset>
                <legend className={labelClass}>Platforms</legend>
                <div className="space-y-1.5">
                  {ALL_PLATFORMS.map((platform) => {
                    const PlatformIcon = PLATFORM_META[platform].icon
                    const on = platforms.includes(platform)
                    return (
                      <label
                        key={platform}
                        className={clsx(
                          'flex min-h-10 cursor-pointer items-center gap-3 rounded-control border px-3 text-sm transition-colors',
                          on
                            ? 'border-accent-line bg-accent-soft text-ink'
                            : 'border-line text-ink-muted hover:bg-surface-2 hover:text-ink',
                        )}
                      >
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
                          className="size-4 shrink-0"
                        />
                        <PlatformIcon aria-hidden className="size-4 shrink-0" />
                        <span className="min-w-0 flex-1 font-medium">
                          {PLATFORM_META[platform].label}
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
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
                  <CalendarCheckIcon aria-hidden />
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
                  <CheckIcon aria-hidden />
                  Already posted, record it
                </button>
              </div>
            </div>
          </Card>

          <Card title="Preview">
            {cover ? (
              <img
                src={`/api/photos/${cover.id}`}
                alt="Cover"
                className="aspect-square w-full rounded-control object-cover"
              />
            ) : (
              <div className="flex aspect-square w-full flex-col items-center justify-center gap-2 rounded-control border border-dashed border-line-strong/60 bg-surface-2 text-xs text-ink-faint">
                <ImageIcon aria-hidden className="size-6" />
                No cover photo
              </div>
            )}
            <p className="mt-3 line-clamp-6 whitespace-pre-wrap break-words text-sm text-ink-muted">
              {caption || 'Caption preview…'}
            </p>
          </Card>
        </div>
      </div>
    </form>
  )
}
