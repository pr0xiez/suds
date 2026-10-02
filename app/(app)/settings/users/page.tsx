import { EnvelopeSimpleIcon, PaperPlaneTiltIcon } from '@phosphor-icons/react/ssr'
import {
  createUserAction,
  resetUserPasswordAction,
  setUserActiveAction,
  setUserRoleAction,
} from '@/app/actions/settings'
import { ErrorBanner } from '@/components/banners'
import { ConfirmSubmit } from '@/components/ConfirmSubmit'
import { SettingsNav } from '@/components/SettingsNav'
import {
  Badge,
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSmall,
  Card,
  Field,
  inputClass,
  PageHeader,
  selectClass,
} from '@/components/ui'
import { requireOwner } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'

export const metadata = { title: 'Users' }

export default async function UsersSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const me = await requireOwner()
  const { error } = await searchParams
  const memberships = await prisma.businessMembership.findMany({
    where: { businessId: me.businessId },
    include: { user: true },
    orderBy: { createdAt: 'asc' },
  })
  const users = memberships.map((membership) => ({
    ...membership.user,
    name: membership.acceptedAt ? membership.user.name : 'Invitation pending',
    role: membership.role,
    active: membership.active,
    pending: !membership.acceptedAt,
  }))

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <SettingsNav current="/settings/users" isOwner />
      <ErrorBanner message={error} />

      <Card title="Invite a teammate" className="mb-6">
        <form action={createUserAction} className="space-y-5">
          <div className="@container">
            <div className="grid grid-cols-1 gap-5 @sm:grid-cols-2 @2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_10rem]">
              <Field label="Name">
                <input name="name" required className={inputClass} />
              </Field>
              <Field label="Email">
                <input name="email" type="email" required className={inputClass} />
              </Field>

              <Field label="Role">
                <select name="role" defaultValue="STAFF" className={selectClass}>
                  <option value="STAFF">Staff</option>
                  <option value="OWNER">Owner</option>
                </select>
              </Field>
            </div>
          </div>
          <div className="flex justify-end border-t border-line pt-5">
            <button type="submit" className={btnPrimary}>
              <PaperPlaneTiltIcon aria-hidden />
              Send invitation
            </button>
          </div>
        </form>
      </Card>

      <Card title={`Users (${users.length})`} padded={false}>
        <ul className="divide-y divide-line">
          {users.map((user) => (
            <li
              key={user.id}
              className="flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span
                  aria-hidden
                  className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-sm font-semibold text-ink-muted"
                >
                  {user.pending ? (
                    <EnvelopeSimpleIcon className="size-4" />
                  ) : (
                    (user.name || user.email).charAt(0).toUpperCase()
                  )}
                </span>
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-ink">
                    <span className="min-w-0 wrap-anywhere">{user.name}</span>
                    {user.id === me.id ? (
                      <span className="text-xs font-normal text-ink-faint">(you)</span>
                    ) : null}
                    {!user.active && !user.pending ? (
                      <Badge tone="danger">Deactivated</Badge>
                    ) : null}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-ink-muted">
                    {user.email} · {user.role === 'OWNER' ? 'Owner' : 'Staff'}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
                <form action={setUserRoleAction}>
                  <input type="hidden" name="id" value={user.id} />
                  <input
                    type="hidden"
                    name="role"
                    value={user.role === 'OWNER' ? 'STAFF' : 'OWNER'}
                  />
                  <button type="submit" className={`${btnSecondary} ${btnSmall}`}>
                    {user.role === 'OWNER' ? 'Make staff' : 'Make owner'}
                  </button>
                </form>
                <form action={setUserActiveAction}>
                  <input type="hidden" name="id" value={user.id} />
                  <input type="hidden" name="active" value={user.active ? '0' : '1'} />
                  {user.active ? (
                    <ConfirmSubmit
                      message={`Deactivate ${user.name}? Their access to this business ends immediately.`}
                      className={`${btnDanger} ${btnSmall}`}
                    >
                      Deactivate
                    </ConfirmSubmit>
                  ) : (
                    <button type="submit" className={`${btnSecondary} ${btnSmall}`}>
                      Reactivate
                    </button>
                  )}
                </form>
                {!user.pending && (
                  <form action={resetUserPasswordAction}>
                    <input type="hidden" name="id" value={user.id} />
                    <button type="submit" className={`${btnSecondary} ${btnSmall}`}>
                      Send recovery email
                    </button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
