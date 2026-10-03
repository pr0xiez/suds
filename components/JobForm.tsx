'use client'

import { CheckIcon, PlusIcon, WarningIcon, XIcon } from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import Link from 'next/link'
import { useState } from 'react'
import { type FormState, saveJobAction } from '@/app/actions/jobs'
import { ErrorBanner } from '@/components/banners'
import {
  btnGhost,
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
import { useActionForm } from '@/components/useActionForm'
import { minutesToHuman } from '@/lib/dates'
import { deriveDuration, type ServiceLine, serviceLines } from '@/lib/jobLines'
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
  /** On the job but no longer offered: shown at its booked values and never added afresh. */
  retired?: boolean
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
  /** The job's stored catalog lines; saving keeps their values while they stay selected. */
  bookedLines: ServiceLine[]
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
  const { state, formAction, pending, onSubmit } = useActionForm<FormState | null>(
    saveJobAction,
    null,
  )
  const [customerId, setCustomerId] = useState(initial.customerId)
  const [vehicleId, setVehicleId] = useState(initial.vehicleId)
  const [serviceIds, setServiceIds] = useState<string[]>(initial.serviceIds)
  const [customLines, setCustomLines] = useState<CustomLineDraft[]>(initial.customLines)
  const [discount, setDiscount] = useState(initial.discount)
  const [durationOverride, setDurationOverride] = useState(initial.durationMin)

  const vehicles = customers.find((c) => c.id === customerId)?.vehicles ?? []

  // The same matching the server saves with: booked lines keep their values, added ones are quoted.
  const { lines } = serviceLines(
    initial.bookedLines,
    serviceIds,
    new Map(services.map((s) => [s.id, s])),
  )
  const bookedLine = (id: string) => initial.bookedLines.find((line) => line.serviceId === id)
  const serviceSum = lines.reduce((sum, line) => sum + line.priceCents, 0)
  const customSum = customLines.reduce((sum, line) => sum + (parseMoneyToCents(line.price) ?? 0), 0)
  const discountCents = parseMoneyToCents(discount) ?? 0
  const total = Math.max(0, serviceSum + customSum - discountCents)
  // The server's rule, so the summary shows the length a save stores; it rejects other overrides.
  const allLines = [
    ...lines,
    ...customLines.map((line) => ({ durationMin: Number(line.durationMin) || 0 })),
  ]
  const overrideMin = durationOverride.trim() === '' ? null : Number(durationOverride)
  const derivedMin = deriveDuration(null, allLines)
  const durationMin = deriveDuration(Number.isInteger(overrideMin) ? overrideMin : null, allLines)

  const toggleService = (id: string) => {
    setServiceIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    )
  }

  const grouped = [
    ...CATEGORY_ORDER.map((category) => ({
      label: CATEGORY_LABELS[category] ?? category,
      services: services.filter((s) => !s.retired && s.category === category),
    })),
    { label: 'No longer offered', services: services.filter((s) => s.retired) },
  ].filter((group) => group.services.length > 0)

  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-6">
      <input type="hidden" name="jobId" value={initial.jobId} />
      <input type="hidden" name="customLines" value={JSON.stringify(customLines)} />
      {/* A checkbox posts its service once; a service repeated on the job posts its extra copies. */}
      {serviceIds
        .filter((id, index) => serviceIds.indexOf(id) !== index)
        .map((id, index) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: copies of one service are interchangeable
          <input key={index} type="hidden" name="serviceIds" value={id} />
        ))}
      <ErrorBanner message={state?.error} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          <Card title="Who and when">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  <option value="">Choose a customer</option>
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
                  <option value="">Choose a vehicle</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Date and time">
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  defaultValue={initial.scheduledAt}
                  className={inputClass}
                  required
                />
              </Field>
              <Field label="Duration override (minutes)" hint="Leave blank to use the services.">
                <input
                  type="number"
                  name="durationMin"
                  min={15}
                  // Booked lengths are plain service totals (20 min, say); a coarser step would
                  // make the browser refuse to submit a pre-filled one.
                  step={1}
                  value={durationOverride}
                  onChange={(e) => setDurationOverride(e.target.value)}
                  placeholder={`Auto, ${minutesToHuman(derivedMin)}`}
                  className={inputClass}
                />
              </Field>
            </div>
            {customerId && vehicles.length === 0 ? (
              <p className="mt-4 flex items-start gap-2 rounded-control border border-warn-line bg-warn-soft px-3 py-2.5 text-sm text-warn">
                <WarningIcon aria-hidden className="mt-0.5 size-4 shrink-0" />
                <span className="min-w-0">
                  This customer has no vehicles yet.{' '}
                  <Link
                    href={`/customers/${customerId}`}
                    className="font-medium underline underline-offset-2"
                  >
                    Add one first
                  </Link>
                  .
                </span>
              </p>
            ) : null}
          </Card>

          <Card title="Services">
            <div className="space-y-5">
              {grouped.map((group) => (
                <fieldset key={group.label}>
                  <legend className={labelClass}>{group.label}</legend>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {group.services.map((service) => {
                      const booked = bookedLine(service.id)
                      // Selected copies as they will save; unselected, what checking would add.
                      const copies = lines.filter((line) => line.serviceId === service.id)
                      const shown = copies.length > 0 ? copies : [booked ?? service]
                      const repriced =
                        booked &&
                        !service.retired &&
                        (booked.priceCents !== service.priceCents ||
                          booked.durationMin !== service.durationMin)
                      const selected = serviceIds.includes(service.id)
                      return (
                        <label
                          key={service.id}
                          className={clsx(
                            'flex min-h-14 cursor-pointer items-center justify-between gap-3 rounded-control border px-3 py-2.5 text-sm transition-colors',
                            selected
                              ? 'border-accent-line bg-accent-soft'
                              : 'border-line bg-surface hover:border-line-strong hover:bg-surface-2',
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-3">
                            <input
                              type="checkbox"
                              name="serviceIds"
                              value={service.id}
                              checked={selected}
                              onChange={() => toggleService(service.id)}
                              className="size-4 shrink-0"
                            />
                            <span className="min-w-0">
                              <span className="block font-medium text-ink">
                                {shown[0]?.name}
                                {copies.length > 1 ? ` ×${copies.length}` : null}
                              </span>
                              <span className="block text-xs tabular-nums text-ink-muted">
                                {minutesToHuman(
                                  shown.reduce((sum, line) => sum + line.durationMin, 0),
                                )}
                              </span>
                              {repriced ? (
                                <span className="block text-xs text-ink-muted">
                                  Booked rate · catalog now {formatCents(service.priceCents)},{' '}
                                  {minutesToHuman(service.durationMin)}
                                </span>
                              ) : null}
                            </span>
                          </span>
                          <span className="shrink-0 font-semibold tabular-nums text-ink">
                            {formatCents(shown.reduce((sum, line) => sum + line.priceCents, 0))}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </fieldset>
              ))}

              <div>
                <p className={labelClass}>Custom lines</p>
                <div className="space-y-2">
                  {customLines.map((line, index) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: rows have no identity beyond position
                      key={index}
                      className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-2 rounded-control bg-surface-2 p-2 sm:grid-cols-[minmax(0,1fr)_7rem_6rem_auto] sm:bg-transparent sm:p-0"
                    >
                      <input
                        aria-label="Line name"
                        className={clsx(inputClass, 'col-span-3 sm:col-span-1')}
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
                        className={clsx(inputClass, 'tabular-nums')}
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
                        className={clsx(inputClass, 'tabular-nums')}
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
                        title="Remove line"
                        className={clsx(btnGhost, 'w-10 px-0!')}
                        onClick={() => setCustomLines((rows) => rows.filter((_, i) => i !== index))}
                      >
                        <XIcon aria-hidden />
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
                    <PlusIcon aria-hidden />
                    Add custom line
                  </button>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Notes">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Job notes" hint="Shown on the invoice.">
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

        <div className="min-w-0 space-y-4 lg:sticky lg:top-6 lg:self-start">
          <Card title="Summary">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">Services</dt>
                <dd className="font-medium tabular-nums text-ink">
                  {formatCents(serviceSum + customSum)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-muted">Discount</dt>
                <dd className="w-28 shrink-0">
                  <input
                    aria-label="Discount"
                    name="discount"
                    className={clsx(inputClass, 'text-right tabular-nums')}
                    placeholder="0"
                    value={discount}
                    onChange={(e) => setDiscount(e.target.value)}
                  />
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <dt className="font-semibold text-ink">Total</dt>
                <dd className="font-display text-xl font-semibold tabular-nums text-ink">
                  {formatCents(total)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink-muted">Est. duration</dt>
                <dd className="text-right tabular-nums text-ink">
                  {minutesToHuman(durationMin)}
                  {durationMin !== derivedMin ? (
                    <span className="block text-xs text-ink-muted">
                      Override, services {minutesToHuman(derivedMin)}
                    </span>
                  ) : null}
                </dd>
              </div>
            </dl>
          </Card>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className={`${btnPrimary} flex-1`}>
              {pending ? null : <CheckIcon aria-hidden />}
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
