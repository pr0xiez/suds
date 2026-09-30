import clsx from 'clsx'
import { deletePhotoAction, setPhotoApprovalAction, setPhotoKindAction } from '@/app/actions/photos'
import { ConfirmSubmit } from '@/components/ConfirmSubmit'
import { PhotoKindBadge } from '@/components/ui'
import type { PhotoKind } from '@/lib/generated/prisma/enums'

const KINDS: Array<{ kind: PhotoKind; short: string; title: string }> = [
  { kind: 'BEFORE', short: 'B', title: 'Mark as before' },
  { kind: 'AFTER', short: 'A', title: 'Mark as after' },
  { kind: 'OTHER', short: 'O', title: 'Mark as other' },
]

export function PhotoTile({
  photo,
  back,
  footer,
  canApprove = false,
}: {
  photo: { id: string; kind: PhotoKind; originalName: string; approvedForMarketing?: boolean }
  /** Path to land on after a mutation — usually the page the tile is on. */
  back: string
  footer?: React.ReactNode
  canApprove?: boolean
}) {
  return (
    <figure className="group relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      <img
        src={`/api/photos/${photo.id}`}
        alt={photo.originalName || 'Job photo'}
        className="aspect-square w-full object-cover"
        loading="lazy"
      />
      <div className="absolute left-1.5 top-1.5">
        <PhotoKindBadge kind={photo.kind} />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-gradient-to-t from-black/60 to-transparent p-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <span className="flex gap-1">
          {KINDS.map(({ kind, short, title }) => (
            <form key={kind} action={setPhotoKindAction}>
              <input type="hidden" name="id" value={photo.id} />
              <input type="hidden" name="kind" value={kind} />
              <input type="hidden" name="back" value={back} />
              <button
                type="submit"
                title={title}
                className={clsx(
                  'h-6 w-6 rounded text-[10px] font-bold',
                  photo.kind === kind
                    ? 'bg-white text-slate-900'
                    : 'bg-white/25 text-white hover:bg-white/50',
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
            className="h-6 w-6 rounded bg-white/25 text-[11px] font-bold text-white hover:bg-rose-500"
          >
            ×
          </ConfirmSubmit>
        </form>
      </div>
      {canApprove ? (
        <form action={setPhotoApprovalAction} className="bg-white px-2 py-2">
          <input type="hidden" name="id" value={photo.id} />
          <input type="hidden" name="back" value={back} />
          <input type="hidden" name="approved" value={photo.approvedForMarketing ? '0' : '1'} />
          <button type="submit" className="text-left text-xs font-medium text-emerald-800">
            {photo.approvedForMarketing
              ? '✓ Approved for marketing · revoke'
              : 'Approve for marketing'}
          </button>
        </form>
      ) : (
        <p className="bg-white px-2 py-2 text-xs text-slate-500">
          {photo.approvedForMarketing ? 'Approved for marketing' : 'Private photo'}
        </p>
      )}
      {footer}
    </figure>
  )
}
