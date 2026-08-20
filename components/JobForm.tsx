'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'
import { type FormState, saveJobAction } from '@/app/actions/jobs'
import { ErrorBanner } from '@/components/banners'
import {
  btnPrimary,
  btnSecondary,
  btnSmall,
  Card,
  Field,
  inputClass,
  labelClass,
  selectClass,
  textareaClass,
} from '@/components/ui'
import { minutesToHuman } from '@/lib/dates'
import { formatCents, parseMoneyToCents } from '@/lib/money'

export interface JobFormCustomer {
  id: string
  name: string
  vehicles: Array<{ id: string; label: string }>
}

export interface JobFormService {
  id: string
  name: string
  priceCents: number
  durationMin: number
  category: string
}

export interface CustomLineDraft {
  name: string
  price: string
  durationMin: string
}

export interface JobFormInitial {
  jobId: string
  customerId: string
  vehicleId: string
  scheduledAt: string
  durationMin: string
  serviceIds: string[]
  customLines: CustomLineDraft[]
  discount: string
  notes: string
  internalNotes: string
}

const CATEGORY_LABELS: Record<string, string> = {
  EXTERIOR: 'Exterior',
  INTERIOR: 'Interior',
  FULL: 'Packages',
  ADDON: 'Add-ons',
}
const CATEGORY_ORDER = ['FULL', 'EXTERIOR', 'INTERIOR', 'ADDON']

export function JobForm({
  customers,
  services,
  initial,
}: {
  customers: JobFormCustomer[]
  services: JobFormService[]
  initial: JobFormInitial
}) {
  const [state, formAction, pending] = useActionState<FormState | null, FormData>(
    saveJobAction,
    null,
  )
  const [customerId, setCustomerId] = useState(initial.customerId)
  const [vehicleId, setVehicleId] = useState(initial.vehicleId)
  const [serviceIds, setServiceIds] = useState<string[]>(initial.serviceIds)
  const [customLines, setCustomLines] = useState<CustomLineDraft[]>(initial.customLines)
  const [discount, setDiscount] = useState(initial.discount)

  const vehicles = customers.find((c) => c.id === customerId)?.vehicles ?? []

  const serviceSum = services
    .filter((s) => serviceIds.includes(s.id))
    .reduce((sum, s) => sum + s.priceCents, 0)
  const customSum = customLines.reduce((sum, line) => sum + (parseMoneyToCents(line.price) ?? 0), 0)
  const discountCents = parseMoneyToCents(discount) ?? 0
  const total = Math.max(0, serviceSum + customSum - discountCents)
  const durationSum =
    services.filter((s) => serviceIds.includes(s.id)).reduce((sum, s) => sum + s.durationMin, 0) +
    customLines.reduce((sum, line) => sum + (Number(line.durationMin) || 0), 0)

  const toggleService = (id: string) => {
    setServiceIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }

  const grouped = CATEGORY_ORDER.map((category) => ({
    category,
    services: services.filter((s) => s.category === category),
  })).filter((group) => group.services.length > 0)

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="jobId" value={initial.jobId} />
      <input type="hidden" name="customLines" value={JSON.stringify(customLines)} />
      <ErrorBanner message={state?.error} />

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <Card title="Who & when">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Customer">
                <select
                  name="customerId"
                  className={selectClass}
                  value={customerId}
                  onChange={(e) => {
                    setCustomerId(e.target.value)
                    const first = customers.find((c) => c.id === e.target.value)?.vehicles[0]
                    setVehicleId(first?.id ?? '')
                  }}
                  required
                >
                  <option value="">— pick —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Vehicle">
                <select
                  name="vehicleId"
                  className={selectClass}
                  value={vehicleId}
                  onChange={(e) => setVehicleId(e.target.value)}
                  required
                >
                  <option value="">— pick —</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date & time">
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  defaultValue={initial.scheduledAt}
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="Duration override (minutes)">
                <input
                  type="number"
                  name="durationMin"
                  min={15}
                  step={15}
                  defaultValue={initial.durationMin}
                  placeholder={`auto — ${minutesToHuman(Math.max(durationSum, 30))}`}
                  className={inputClass}
                />
              </Field>
            </div>
            {customerId && vehicles.length === 0 ? (
              <p className="mt-3 text-sm text-amber-700">
                This customer has no vehicles yet —{' '}
                <Link href={`/customers/${customerId}`} className="underline">
                  add one first
                </Link>
                .
              </p>
            ) : null}
          </Card>

          <Card title="Services">
            <div className="space-y-4">
              {grouped.map((group) => (
                <div key={group.category}>
                  <p className={labelClass}>{CATEGORY_LABELS[group.category] ?? group.category}</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {group.services.map((service) => (
                      <label
                        key={service.id}
                        className={`flex cursor-pointer items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm transition-colors ${
                          serviceIds.includes(service.id)
                            ? 'border-cyan-600 bg-cyan-50'
                            : 'border-slate-200 bg-white hover:border-slate-300'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            name="serviceIds"
                            value={service.id}
                            checked={serviceIds.includes(service.id)}
                            onChange={() => toggleService(service.id)}
                            className="accent-cyan-700"
                          />
                          <span>
                            <span className="block font-medium text-slate-900">{service.name}</span>
                            <span className="block text-xs text-slate-500">
                              {minutesToHuman(service.durationMin)}
                            </span>
                          </span>
                        </span>
                        <span className="font-semibold tabular-nums text-slate-700">
                          {formatCents(service.priceCents)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <div>
                <p className={labelClass}>Custom lines</p>
                <div className="space-y-2">
                  {customLines.map((line, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity beyond position
                    <div key={index} className="flex items-center gap-2">
                      <input
                        aria-label="Line name"
                        className={inputClass}
                        placeholder="e.g. Excessive pet hair"
                        value={line.name}
                        onChange={(e) =>
                          setCustomLines((rows) =>
                            rows.map((row, i) =>
                              i === index ? { ...row, name: e.target.value } : row,
                            ),
                          )
                        }
                      />
                      <input
                        aria-label="Line price"
                        className={`${inputClass} w-28 shrink-0`}
                        placeholder="$"
                        value={line.price}
                        onChange={(e) =>
                          setCustomLines((rows) =>
                            rows.map((row, i) =>
                              i === index ? { ...row, price: e.target.value } : row,
                            ),
                          )
                        }
                      />
                      <input
                        aria-label="Line minutes"
                        className={`${inputClass} w-24 shrink-0`}
                        placeholder="min"
                        value={line.durationMin}
                        onChange={(e) =>
                          setCustomLines((rows) =>
                            rows.map((row, i) =>
                              i === index ? { ...row, durationMin: e.target.value } : row,
                            ),
                          )
                        }
                      />
                      <button
                        type="button"
                        aria-label="Remove line"
                        className={`${btnSecondary} ${btnSmall} shrink-0`}
                        onClick={() => setCustomLines((rows) => rows.filter((_, i) => i !== index))}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className={`${btnSecondary} ${btnSmall}`}
                    onClick={() =>
                      setCustomLines((rows) => [...rows, { name: '', price: '', durationMin: '' }])
                    }
                  >
                    + Add custom line
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Notes">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Job notes (visible on invoice)">
                <textarea name="notes" defaultValue={initial.notes} className={textareaClass} />
              </Field>
              <Field label="Internal notes">
                <textarea
                  name="internalNotes"
                  defaultValue={initial.internalNotes}
                  className={textareaClass}
                />
              </Field>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Summary">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Services</dt>
                <dd className="font-medium tabular-nums">{formatCents(serviceSum + customSum)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-slate-500">Discount</dt>
                <dd>
                  <input
                    aria-label="Discount"
                    name="discount"
                    className={`${inputClass} w-24 text-right`}
                    placeholder="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </dd>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
                <dt className="font-semibold">Total</dt>
                <dd className="font-bold tabular-nums">{formatCents(total)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Est. duration</dt>
                <dd className="tabular-nums text-slate-700">
                  {minutesToHuman(Math.max(durationSum, 30))}
                </dd>
              </div>
            </dl>
          </Card>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={`${btnPrimary} flex-1`}>
              {pending ? 'Saving…' : initial.jobId ? 'Save job' : 'Book job'}
            </button>
            <Link
              href={initial.jobId ? `/jobs/${initial.jobId}` : '/jobs'}
              className={btnSecondary}
            >
              Cancel
            </Link>
          </div>
        </div>
      </div>
    </form>
  )
}
