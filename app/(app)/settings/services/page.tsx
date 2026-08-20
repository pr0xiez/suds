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

function ServiceFields({ defaults }: { defaults?: Service }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Field label="Name" className="col-span-2">
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
        <input
          name="price"
          defaultValue={defaults ? (defaults.priceCents / 100).toFixed(2) : ''}
          required
          placeholder="150"
          className={inputClass}
        />
      </Field>
      <Field label="Duration (min)">
        <input
          name="durationMin"
          type="number"
          min={0}
          step={15}
          defaultValue={defaults?.durationMin ?? 60}
          required
          className={inputClass}
        />
      </Field>
      <Field label="Sort order">
        <input
          name="sort"
          type="number"
          defaultValue={defaults?.sort ?? 0}
          className={inputClass}
        />
      </Field>
      <Field label="Description" className="col-span-2 sm:col-span-2">
        <input name="description" defaultValue={defaults?.description} className={inputClass} />
      </Field>
      <label className="flex items-end gap-2 pb-2 text-sm">
        <input
          type="checkbox"
          name="active"
          defaultChecked={defaults ? defaults.active : true}
          className="accent-cyan-700"
        />
        Active (bookable)
      </label>
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
    orderBy: [{ active: 'desc' }, { sort: 'asc' }, { name: 'asc' }],
  })

  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" />
      <SettingsNav current="/settings/services" isOwner={user.role === 'OWNER'} />
      <ErrorBanner message={error} />

      <Card title="Add a service" className="mb-6">
        <form action={createServiceAction} className="space-y-4">
          <ServiceFields />
          <button type="submit" className={btnPrimary}>
            Add service
          </button>
        </form>
      </Card>

      <Card title={`Catalog (${services.length})`} padded={false}>
        <ul className="divide-y divide-slate-100">
          {services.map((service) => (
            <li key={service.id} className={clsx(!service.active && 'opacity-50')}>
              <details>
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
                  <span className="min-w-0">
                    <span className="font-medium text-slate-900">{service.name}</span>
                    <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                      {CATEGORY_LABELS[service.category]}
                    </span>
                    {!service.active ? (
                      <span className="ml-2 text-xs text-slate-400">inactive</span>
                    ) : null}
                    {service.description ? (
                      <span className="block truncate text-xs text-slate-500">
                        {service.description}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right text-sm">
                    <span className="font-semibold tabular-nums">
                      {formatCents(service.priceCents)}
                    </span>
                    <span className="block text-xs text-slate-400">
                      {minutesToHuman(service.durationMin)}
                    </span>
                  </span>
                </summary>
                <div className="space-y-3 border-t border-slate-100 bg-slate-50/50 p-4">
                  <form action={updateServiceAction} className="space-y-3">
                    <input type="hidden" name="id" value={service.id} />
                    <ServiceFields defaults={service} />
                    <button type="submit" className={`${btnSecondary} ${btnSmall}`}>
                      Save
                    </button>
                  </form>
                  <form action={deleteServiceAction}>
                    <input type="hidden" name="id" value={service.id} />
                    <ConfirmSubmit
                      message="Delete this service? Past jobs keep their snapshot lines."
                      className={`${btnDanger} ${btnSmall}`}
                    >
                      Delete
                    </ConfirmSubmit>
                  </form>
                </div>
              </details>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}
