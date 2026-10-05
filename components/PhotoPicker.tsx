'use client'
import { CheckIcon } from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import { labelClass } from '@/components/ui'
import { MAX_RUN_PHOTOS } from '@/lib/aiRunStatus'

type PickerPhoto = { id: string; label: string }

/**
 * Ordered multi-select of approved photos, capped at MAX_RUN_PHOTOS. Selected
 * photos show a check, or their position when `numbered` (order matters).
 */
export function PhotoPicker({
  photos,
  value,
  onChange,
  hint,
  numbered = false,
  gridClass = 'max-h-64 grid-cols-4 sm:grid-cols-5',
}: {
  photos: PickerPhoto[]
  value: string[]
  onChange: (ids: string[]) => void
  hint: string
  numbered?: boolean
  gridClass?: string
}) {
  function toggle(id: string) {
    if (value.includes(id)) onChange(value.filter((item) => item !== id))
    else if (value.length < MAX_RUN_PHOTOS) onChange([...value, id])
  }
  return (
    <div>
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3">
        <p className={clsx(labelClass, 'mb-0')}>Photos</p>
        <p className="text-xs tabular-nums text-ink-muted">
          {value.length} of {MAX_RUN_PHOTOS} selected
        </p>
      </div>
      <p className="mb-3 text-xs text-ink-muted">{hint}</p>
      <div className={clsx('-m-1 grid gap-2 overflow-y-auto p-1', gridClass)}>
        {photos.map((photo) => {
          const index = value.indexOf(photo.id)
          const selected = index >= 0
          return (
            <button
              key={photo.id}
              type="button"
              aria-pressed={selected}
              onClick={() => toggle(photo.id)}
              className={clsx(
                'relative overflow-hidden rounded-control bg-surface-2 transition-shadow',
                selected ? 'ring-2 ring-accent-ink' : 'ring-1 ring-line hover:ring-line-strong',
              )}
            >
              <img
                src={`/api/photos/${photo.id}`}
                alt={photo.label}
                className="aspect-square w-full object-cover"
              />
              {selected ? (
                <span className="absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-accent text-xs font-bold tabular-nums text-on-accent shadow-float">
                  {numbered ? (
                    index + 1
                  ) : (
                    <CheckIcon aria-hidden className="size-3" weight="bold" />
                  )}
                </span>
              ) : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
