import {
  CaretDownIcon,
  CarProfileIcon,
  CheckCircleIcon,
  ClipboardTextIcon,
  EnvelopeSimpleIcon,
  MapPinIcon,
  PaperPlaneTiltIcon,
  PencilSimpleIcon,
  PhoneIcon,
  PlusIcon,
  TrashIcon,
} from '@phosphor-icons/react/ssr'
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
  Badge,
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

/** Disclosure summary row: hides the native marker so the caret icon can stand in. */
const summaryRow =
  'flex cursor-pointer list-none items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 sm:px-5 [&::-webkit-details-marker]:hidden'

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
  const hasContact = Boolean(customer.phone || customer.email || customer.address)

  return (
    <div>
      <PageHeader
        back={{ href: '/customers', label: 'Customers' }}
        title={customer.name}
        subtitle={
          hasContact ? (
            <span className="flex flex-wrap gap-x-5 gap-y-1.5">
              {customer.phone ? (
                <a
                  href={`tel:${customer.phone}`}
                  className="inline-flex items-center gap-1.5 tabular-nums transition-colors hover:text-ink"
                >
                  <PhoneIcon aria-hidden className="size-4 shrink-0 text-ink-faint" />
                  {customer.phone}
                </a>
              ) : null}
              {customer.email ? (
                <a
                  href={`mailto:${customer.email}`}
                  className="inline-flex min-w-0 items-center gap-1.5 transition-colors hover:text-ink"
                >
                  <EnvelopeSimpleIcon aria-hidden className="size-4 shrink-0 text-ink-faint" />
                  <span className="min-w-0 wrap-anywhere">{customer.email}</span>
                </a>
              ) : null}
              {customer.address ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPinIcon aria-hidden className="size-4 shrink-0 text-ink-faint" />
                  <span className="min-w-0 wrap-anywhere">{customer.address}</span>
                </span>
              ) : null}
            </span>
          ) : undefined
        }
        actions={
          <>
            <Link href={`/jobs/new?customer=${customer.id}`} className={btnPrimary}>
              <PlusIcon aria-hidden />
              New job
            </Link>
            <form action={deleteCustomerAction}>
              <input type="hidden" name="id" value={customer.id} />
              <ConfirmSubmit
                message="Delete this customer and their vehicles?"
                className={btnDanger}
              >
                <TrashIcon aria-hidden />
                Delete
              </ConfirmSubmit>
            </form>
          </>
        }
      />

      <ErrorBanner message={error} />
      <SuccessBanner message={saved ? 'Saved.' : null} />
      <SuccessBanner message={invited ? 'Portal invitation queued for email delivery.' : null} />

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card title="Contact details" className="xl:self-start">
          <form action={updateCustomerAction} className="space-y-6">
            <input type="hidden" name="id" value={customer.id} />
            <CustomerFields defaults={customer} />
            <div className="flex justify-end border-t border-line pt-5">
              <button type="submit" className={btnSecondary}>
                Save details
              </button>
            </div>
          </form>
        </Card>

        <div className="space-y-6">
          <Card title={`Vehicles (${customer.vehicles.length})`} padded={false}>
            {customer.vehicles.length === 0 ? (
              <div className="p-4 sm:p-5">
                <EmptyState
                  icon={CarProfileIcon}
                  title="No vehicles yet"
                  hint="A job needs a vehicle. Add one below."
                />
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {customer.vehicles.map((vehicle) => (
                  <li key={vehicle.id}>
                    <details className="group">
                      <summary className={summaryRow}>
                        <span className="grid size-9 shrink-0 place-items-center rounded-control bg-surface-2 text-ink-muted">
                          <CarProfileIcon aria-hidden className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-ink">
                            {describeVehicle(vehicle)}
                          </span>
                          {vehicle.plate ? (
                            <span className="mt-0.5 block truncate font-mono text-xs text-ink-muted">
                              {vehicle.plate}
                            </span>
                          ) : null}
                        </span>
                        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-accent-ink">
                          <PencilSimpleIcon aria-hidden className="size-3.5" />
                          Edit
                          <CaretDownIcon
                            aria-hidden
                            className="size-3.5 transition-transform group-open:rotate-180"
                          />
                        </span>
                      </summary>
                      <div className="relative border-t border-line bg-surface-2/50 p-4 sm:p-5">
                        <form action={updateVehicleAction} className="space-y-4">
                          <input type="hidden" name="id" value={vehicle.id} />
                          <input type="hidden" name="customerId" value={customer.id} />
                          <VehicleFields defaults={vehicle} />
                          <div className="flex justify-end">
                            <button type="submit" className={`${btnSecondary} ${btnSmall}`}>
                              Save vehicle
                            </button>
                          </div>
                        </form>
                        {/* Sits on the save row; a separate form because forms cannot nest. */}
                        <form
                          action={deleteVehicleAction}
                          className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5"
                        >
                          <input type="hidden" name="id" value={vehicle.id} />
                          <input type="hidden" name="customerId" value={customer.id} />
                          <ConfirmSubmit
                            message="Delete this vehicle?"
                            className={`${btnDanger} ${btnSmall}`}
                          >
                            <TrashIcon aria-hidden />
                            Delete vehicle
                          </ConfirmSubmit>
                        </form>
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            )}
            <details className="group border-t border-line">
              <summary className={`${summaryRow} min-h-12 text-sm font-medium text-accent-ink`}>
                <PlusIcon aria-hidden className="size-4 shrink-0" />
                <span className="flex-1">Add vehicle</span>
                <CaretDownIcon
                  aria-hidden
                  className="size-3.5 shrink-0 transition-transform group-open:rotate-180"
                />
              </summary>
              <form
                action={addVehicleAction}
                className="space-y-4 border-t border-line bg-surface-2/50 p-4 sm:p-5"
              >
                <input type="hidden" name="customerId" value={customer.id} />
                <VehicleFields />
                <div className="flex justify-end">
                  <button type="submit" className={`${btnPrimary} ${btnSmall}`}>
                    <PlusIcon aria-hidden />
                    Add vehicle
                  </button>
                </div>
              </form>
            </details>
          </Card>

          {user.businessRole === 'OWNER' && (
            <Card
              title="Customer portal"
              actions={
                customer.userId ? (
                  <Badge tone="ok">
                    <CheckCircleIcon aria-hidden className="size-3.5" />
                    Linked
                  </Badge>
                ) : (
                  <Badge>Not linked</Badge>
                )
              }
            >
              {customer.userId ? (
                <p className="text-sm text-ink-muted">
                  This customer has linked their appointment portal.
                </p>
              ) : (
                <>
                  <p className="text-sm text-ink-muted">
                    Invite this customer to view their vehicles, appointments, and invoices after
                    confirming their email.
                  </p>
                  <form action={inviteCustomerPortalAction} className="mt-4">
                    <input type="hidden" name="id" value={customer.id} />
                    <button type="submit" disabled={!customer.email} className={btnSecondary}>
                      <PaperPlaneTiltIcon aria-hidden />
                      Invite to customer portal
                    </button>
                  </form>
                  {!customer.email && (
                    <p className="mt-2 text-xs text-ink-muted">
                      Add an email address to send an invitation.
                    </p>
                  )}
                </>
              )}
            </Card>
          )}
        </div>
      </div>

      <Card title={`Job history (${customer.jobs.length})`} padded={false} className="mt-6">
        {customer.jobs.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState icon={ClipboardTextIcon} title="No jobs yet" />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {customer.jobs.map((job) => (
              <li key={job.id}>
                <Link
                  href={`/jobs/${job.id}`}
                  className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5"
                >
                  <span className="hidden w-44 shrink-0 text-sm font-medium tabular-nums text-ink sm:block">
                    {formatDateTime(job.scheduledAt, tz)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink sm:font-normal">
                      {job.items[0]?.name ?? 'No services'}
                      {job.items.length > 1 ? ` +${job.items.length - 1}` : ''}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-ink-muted">
                      <span className="tabular-nums sm:hidden">
                        {formatDateTime(job.scheduledAt, tz)},{' '}
                      </span>
                      {job.vehicle.make} {job.vehicle.model}
                    </span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-4">
                    <span className="text-sm font-semibold tabular-nums text-ink">
                      {formatCents(jobTotalCents(job))}
                    </span>
                    <span className="flex sm:w-24 sm:justify-end">
                      <JobStatusBadge status={job.status} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
