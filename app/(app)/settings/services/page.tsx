import { CaretDownIcon, PlusIcon, TagIcon, TrashIcon } from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import {
  createServiceAction,
  deleteServiceAction,
  updateServiceAction,
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
  EmptyState,
  Field,
  inputClass,
  PageHeader,
  selectClass,
} from '@/components/ui'
import { requireUser } from '@/lib/auth/session'
import { minutesToHuman } from '@/lib/dates'
import { prisma } from '@/lib/db/client'
import type { Service } from '@/lib/generated/prisma/client'
import { formatCents } from '@/lib/money'

export const metadata = { title: 'Services' }

const CATEGORY_LABELS: Record<string, string> = {
  FULL: 'Package',
  EXTERIOR: 'Exterior',
  INTERIOR: 'Interior',
  ADDON: 'Add-on',
}

/** Columns follow the card width, so the same fields fit the add card and an open row. */
function ServiceFields({ defaults }: { defaults?: Service }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-5 @sm:grid-cols-2 @xl:grid-cols-4">
        <Field label="Name" className="@sm:col-span-2">
          <input name="name" defaultValue={defaults?.name} required className={inputClass} />
        </Field>
        <Field label="Category">
          <select
            name="category"
            defaultValue={defaults?.category ?? 'EXTERIOR'}
            className={selectClass}
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Price">
          <div className="relative">
            <span
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-ink-muted"
            >
              $
            </span>
            <input
              name="price"
              defaultValue={defaults ? (defaults.priceCents / 100).toFixed(2) : ''}
              required
              placeholder="150"
              className={clsx(inputClass, 'pl-7 tabular-nums')}
            />
          </div>
        </Field>
        <Field label="Duration (min)">
          <input
            name="durationMin"
            type="number"
            min={0}
            step={15}
            defaultValue={defaults?.durationMin ?? 60}
            required
            className={clsx(inputClass, 'tabular-nums')}
          />
        </Field>
        <Field label="Sort order">
          <input
            name="sort"
            type="number"
            defaultValue={defaults?.sort ?? 0}
            className={clsx(inputClass, 'tabular-nums')}
          />
        </Field>
        <Field label="Description" className="@sm:col-span-2">
          <input name="description" defaultValue={defaults?.description} className={inputClass} />
        </Field>
        <label className="flex min-h-10 items-center gap-2.5 text-sm text-ink @sm:col-span-2 @xl:col-span-4">
          <input
            type="checkbox"
            name="active"
            defaultChecked={defaults ? defaults.active : true}
            className="size-4 shrink-0"
          />
          Active (bookable)
        </label>
      </div>
    </div>
  )
}

export default async function ServicesSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const user = await requireUser()
  const { error } = await searchParams
  const services = await prisma.service.findMany({
    where: { businessId: user.businessId },
    orderBy: [{ active: 'desc' }, { sort: 'asc' }, { name: 'asc' }],
  })

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <SettingsNav current="/settings/services" isOwner={user.businessRole === 'OWNER'} />
      <ErrorBanner message={error} />

      <Card title="Add a service" className="mb-6">
        <form action={createServiceAction} className="space-y-5">
          <ServiceFields />
          <div className="flex justify-end border-t border-line pt-5">
            <button type="submit" className={btnPrimary}>
              <PlusIcon aria-hidden />
              Add service
            </button>
          </div>
        </form>
      </Card>

      <Card title={`Catalog (${services.length})`} padded={false}>
        {services.length === 0 ? (
          <div className="p-4 sm:p-5">
            <EmptyState icon={TagIcon} title="No services yet" hint="Add your first one above." />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {services.map((service) => (
              <li key={service.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-2 sm:px-5 [&::-webkit-details-marker]:hidden">
                    <span className={clsx('min-w-0 flex-1', !service.active && 'opacity-60')}>
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="min-w-0 text-sm font-medium text-ink">{service.name}</span>
                        <Badge>{CATEGORY_LABELS[service.category]}</Badge>
                        {!service.active ? <Badge>Inactive</Badge> : null}
                      </span>
                      {service.description ? (
                        <span className="mt-0.5 block truncate text-xs text-ink-muted">
                          {service.description}
                        </span>
                      ) : null}
                    </span>
                    <span className={clsx('shrink-0 text-right', !service.active && 'opacity-60')}>
                      <span className="block text-sm font-semibold tabular-nums text-ink">
                        {formatCents(service.priceCents)}
                      </span>
                      <span className="block text-xs tabular-nums text-ink-muted">
                        {minutesToHuman(service.durationMin)}
                      </span>
                    </span>
                    <CaretDownIcon
                      aria-hidden
                      className="size-4 shrink-0 text-ink-faint transition-transform group-open:rotate-180"
                    />
                  </summary>
                  <div className="relative border-t border-line bg-surface-2/50 p-4 sm:p-5">
                    <form action={updateServiceAction} className="space-y-4">
                      <input type="hidden" name="id" value={service.id} />
                      <ServiceFields defaults={service} />
                      <div className="flex justify-end">
                        <button type="submit" className={`${btnSecondary} ${btnSmall}`}>
                          Save
                        </button>
                      </div>
                    </form>
                    {/* Sits on the save row; a separate form because forms cannot nest. */}
                    <form
                      action={deleteServiceAction}
                      className="absolute bottom-4 left-4 sm:bottom-5 sm:left-5"
                    >
                      <input type="hidden" name="id" value={service.id} />
                      <ConfirmSubmit
                        message="Delete this service? Past jobs keep their snapshot lines."
                        className={`${btnDanger} ${btnSmall}`}
                      >
                        <TrashIcon aria-hidden />
                        Delete
                      </ConfirmSubmit>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
