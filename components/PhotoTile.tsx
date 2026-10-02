import { LockSimpleIcon, ShieldCheckIcon, TrashIcon } from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import { deletePhotoAction, setPhotoApprovalAction, setPhotoKindAction } from '@/app/actions/photos'
import { ConfirmSubmit } from '@/components/ConfirmSubmit'
import { Badge, PhotoKindBadge } from '@/components/ui'
import type { PhotoKind } from '@/lib/generated/prisma/enums'

const KINDS: Array<{ kind: PhotoKind; short: string; title: string }> = [
  { kind: 'BEFORE', short: 'B', title: 'Mark as before' },
  { kind: 'AFTER', short: 'A', title: 'Mark as after' },
  { kind: 'OTHER', short: 'O', title: 'Mark as other' },
]

/** Controls that sit on the photo itself, so they use the fixed chrome fills. */
const overlayButton =
  'grid size-7 place-items-center rounded-tight text-[11px] font-bold backdrop-blur-sm transition-colors'

export function PhotoTile({
  photo,
  back,
  footer,
  canApprove = false,
}: {
  photo: { id: string; kind: PhotoKind; originalName: string; approvedForMarketing?: boolean }
  /** Path to land on after a mutation, usually the page the tile is on. */
  back: string
  footer?: React.ReactNode
  canApprove?: boolean
}) {
  const approval = photo.approvedForMarketing ? (
    <Badge tone="ok" className="min-w-0">
      <ShieldCheckIcon aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">Approved</span>
      <span className="sr-only"> for marketing</span>
    </Badge>
  ) : (
    <Badge className="min-w-0">
      <LockSimpleIcon aria-hidden className="size-3.5 shrink-0" />
      <span className="truncate">Private</span>
      <span className="sr-only"> photo, not approved for marketing</span>
    </Badge>
  )

  return (
    <figure className="group relative flex min-w-0 flex-col overflow-hidden rounded-control border border-line bg-surface shadow-panel">
      <div className="relative bg-surface-2">
        <img
          src={`/api/photos/${photo.id}`}
          alt={photo.originalName || 'Job photo'}
          className="aspect-square w-full object-cover"
          loading="lazy"
        />
        <div className="absolute left-1.5 top-1.5">
          <PhotoKindBadge kind={photo.kind} />
        </div>
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-chrome/75 to-transparent p-1.5 pt-6 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <span className="flex gap-1">
            {KINDS.map(({ kind, short, title }) => (
              <form key={kind} action={setPhotoKindAction}>
                <input type="hidden" name="id" value={photo.id} />
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="back" value={back} />
                <button
                  type="submit"
                  title={title}
                  aria-label={title}
                  className={clsx(
                    overlayButton,
                    photo.kind === kind
                      ? 'bg-chrome-ink text-chrome'
                      : 'bg-chrome/60 text-chrome-ink hover:bg-chrome/90',
                  )}
                >
                  {short}
                </button>
              </form>
            ))}
          </span>
          <form action={deletePhotoAction}>
            <input type="hidden" name="id" value={photo.id} />
            <input type="hidden" name="back" value={back} />
            <ConfirmSubmit
              message="Delete this photo? Posts using it lose it too."
              className={clsx(overlayButton, 'bg-chrome/60 text-chrome-ink hover:bg-danger')}
            >
              <TrashIcon aria-hidden className="size-3.5" />
              <span className="sr-only">Delete photo</span>
            </ConfirmSubmit>
          </form>
        </div>
      </div>
      {footer}
      {canApprove ? (
        <form
          action={setPhotoApprovalAction}
          className="mt-auto flex flex-wrap items-center justify-between gap-x-2 gap-y-1 px-2 py-2"
        >
          <input type="hidden" name="id" value={photo.id} />
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="approved" value={photo.approvedForMarketing ? '0' : '1'} />
          {approval}
          <button
            type="submit"
            aria-label={
              photo.approvedForMarketing ? 'Revoke marketing approval' : 'Approve for marketing'
            }
            className={clsx(
              'min-h-7 rounded-tight px-1.5 text-xs font-medium transition-colors',
              photo.approvedForMarketing
                ? 'text-ink-muted hover:bg-surface-2 hover:text-ink'
                : 'text-accent-ink hover:bg-accent-soft',
            )}
          >
            {photo.approvedForMarketing ? 'Revoke' : 'Approve'}
          </button>
        </form>
      ) : (
        <p className="mt-auto flex px-2 py-2">{approval}</p>
      )}
    </figure>
  )
}
