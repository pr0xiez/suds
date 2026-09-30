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
        <form action={createUserAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
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
          <button type="submit" className={btnPrimary}>
            Send invitation
          </button>
        </form>
      </Card>

      <Card title={`Users (${users.length})`} padded={false}>
        <ul className="divide-y divide-slate-100">
          {users.map((user) => (
            <li key={user.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900">
                    {user.name}
                    {user.id === me.id ? (
                      <span className="ml-2 text-xs text-slate-400">(you)</span>
                    ) : null}
                    {!user.active && !user.pending ? (
                      <span className="ml-2 text-xs font-semibold text-rose-500">deactivated</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-slate-500">
                    {user.email} · {user.role === 'OWNER' ? 'Owner' : 'Staff'}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
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
                        className={`${btnSecondary} ${btnSmall}`}
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
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
