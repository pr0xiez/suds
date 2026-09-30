import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  addVehicleAction,
  deleteCustomerAction,
  deleteVehicleAction,
  inviteCustomerPortalAction,
  updateCustomerAction,
  updateVehicleAction,
} from '@/app/actions/customers'
import { ErrorBanner, SuccessBanner } from '@/components/banners'
import { ConfirmSubmit } from '@/components/ConfirmSubmit'
import { CustomerFields, VehicleFields } from '@/components/entityFields'
import {
  btnDanger,
  btnPrimary,
  btnSecondary,
  btnSmall,
  Card,
  EmptyState,
  JobStatusBadge,
  PageHeader,
} from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { describeVehicle } from '@/lib/captions'
import { formatDateTime } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import { formatCents, jobTotalCents } from '@/lib/money'
import { getSettings } from '@/lib/ops/settings'

export const metadata = { title: 'Customer' }

export default async function CustomerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ error?: string; saved?: string; invited?: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  const { error, saved, invited } = await searchParams
  const [settings, customer] = await Promise.all([
    getSettings(user.businessId),
    prisma.customer.findUnique({
      where: { businessId: user.businessId, id },
      include: {
        vehicles: { orderBy: { createdAt: 'asc' } },
        jobs: {
          include: { vehicle: true, items: true },
          orderBy: { scheduledAt: 'desc' },
          take: 25,
        },
      },
    }),
  ])
  if (!customer) notFound()
  const tz = settings.timezone

  return (
    <div>
      <PageHeader
        title={customer.name}
        subtitle={[customer.phone, customer.email].filter(Boolean).join(' · ') || undefined}
        actions={
          <>
            <Link href={`/jobs/new?customer=${customer.id}`} className={btnPrimary}>
              + New job
            </Link>
            <form action={deleteCustomerAction}>
              <input type="hidden" name="id" value={customer.id} />
              <ConfirmSubmit
                message="Delete this customer and their vehicles?"
                className={btnDanger}
              >
                Delete
              </ConfirmSubmit>
            </form>
          </>
        }
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={saved ? 'Saved.' : null} />
      <SuccessBanner message={invited ? 'Portal invitation queued for email delivery.' : null} />

      {user.businessRole === 'OWNER' && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm">
          {customer.userId ? (
            <p className="text-emerald-800">This customer has linked their appointment portal.</p>
          ) : (
            <>
              <p className="text-slate-600">
                Invite this customer to view their vehicles, appointments, and invoices after
                confirming their email.
              </p>
              <form action={inviteCustomerPortalAction} className="mt-3">
                <input type="hidden" name="id" value={customer.id} />
                <button type="submit" disabled={!customer.email} className={btnSecondary}>
                  Invite to customer portal
                </button>
              </form>
              {!customer.email && (
                <p className="mt-2 text-xs text-slate-500">
                  Add an email address to send an invitation.
                </p>
              )}
            </>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Details">
          <form action={updateCustomerAction} className="space-y-4">
            <input type="hidden" name="id" value={customer.id} />
            <CustomerFields defaults={customer} />
            <button type="submit" className={btnSecondary}>
              Save details
            </button>
          </form>
        </Card>

        <Card title={`Vehicles (${customer.vehicles.length})`}>
          <div className="space-y-3">
            {customer.vehicles.length === 0 ? (
              <EmptyState title="No vehicles yet" hint="A job needs a vehicle — add one below." />
            ) : (
              <ul className="space-y-2">
                {customer.vehicles.map((vehicle) => (
                  <li key={vehicle.id} className="rounded-lg border border-slate-200">
                    <details>
                      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-sm">
                        <span>
                          <span className="font-medium text-slate-900">
                            {describeVehicle(vehicle)}
                          </span>
                          {vehicle.plate ? (
                            <span className="ml-2 text-xs text-slate-400">{vehicle.plate}</span>
                          ) : null}
                        </span>
                        <span className="text-xs text-cyan-700">edit</span>
                      </summary>
                      <div className="space-y-3 border-t border-slate-100 p-3">
                        <form action={updateVehicleAction} className="space-y-3">
                          <input type="hidden" name="id" value={vehicle.id} />
                          <input type="hidden" name="customerId" value={customer.id} />
                          <VehicleFields defaults={vehicle} />
                          <button type="submit" className={`${btnSecondary} ${btnSmall}`}>
                            Save vehicle
                          </button>
                        </form>
                        <form action={deleteVehicleAction}>
                          <input type="hidden" name="id" value={vehicle.id} />
                          <input type="hidden" name="customerId" value={customer.id} />
                          <ConfirmSubmit
                            message="Delete this vehicle?"
                            className={`${btnDanger} ${btnSmall}`}
                          >
                            Delete vehicle
                          </ConfirmSubmit>
                        </form>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
            <details className="rounded-lg border border-dashed border-slate-300">
              <summary className="cursor-pointer list-none px-3 py-2.5 text-sm font-medium text-cyan-700">
                + Add vehicle
              </summary>
              <form action={addVehicleAction} className="space-y-3 border-t border-slate-100 p-3">
                <input type="hidden" name="customerId" value={customer.id} />
                <VehicleFields />
                <button type="submit" className={`${btnPrimary} ${btnSmall}`}>
                  Add vehicle
                </button>
              </form>
            </details>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card title={`Job history (${customer.jobs.length})`} padded={false}>
          {customer.jobs.length === 0 ? (
            <div className="p-4">
              <EmptyState title="No jobs yet" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <tbody className="divide-y divide-slate-100">
                  {customer.jobs.map((job) => (
                    <tr key={job.id} className="relative hover:bg-slate-50">
                      <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">
                        <Link href={`/jobs/${job.id}`} className="after:absolute after:inset-0">
                          {formatDateTime(job.scheduledAt, tz)}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">
                        {job.vehicle.make} {job.vehicle.model}
                      </td>
                      <td className="max-w-52 truncate px-4 py-2.5 text-slate-600">
                        {job.items[0]?.name ?? '—'}
                        {job.items.length > 1 ? ` +${job.items.length - 1}` : ''}
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums">
                        {formatCents(jobTotalCents(job))}
                      </td>
                      <td className="px-4 py-2.5">
                        <JobStatusBadge status={job.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
