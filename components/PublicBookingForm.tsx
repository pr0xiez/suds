'use client'

import {
  CalendarCheckIcon,
  ClockIcon,
  LightningIcon,
  PaperPlaneTiltIcon,
} from '@phosphor-icons/react/ssr'
import { useState } from 'react'
import { bookAppointmentAction } from '@/app/actions/bookings'
import { BookingActionForm } from '@/components/BookingActionForm'
import { bookingButton, bookingInput } from '@/components/bookingStyles'
import { Field, textareaClass } from '@/components/ui'

export function PublicBookingForm({
  slug,
  serviceId,
  slots,
  request,
  idempotencyKey,
  vehicles,
  phone,
  address,
  selectedTime,
}: {
  slug: string
  serviceId: string
  slots: Array<{ value: string; label: string }>
  request: boolean
  idempotencyKey: string
  vehicles: Array<{ id: string; label: string }>
  phone: string
  address: string
  selectedTime?: string
}) {
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id ?? '')
  return (
    <BookingActionForm
      action={bookAppointmentAction}
      label={request ? 'Request this appointment' : 'Confirm appointment'}
      className="space-y-5"
      submitClassName={`${bookingButton} w-full`}
      icon={request ? <PaperPlaneTiltIcon aria-hidden /> : <CalendarCheckIcon aria-hidden />}
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <fieldset>
        <legend className="mb-3 text-sm font-medium text-ink">Choose your time</legend>
        <div className="-m-1 grid max-h-80 grid-cols-2 gap-2 overflow-y-auto p-1 sm:grid-cols-3">
          {slots.map((slot) => (
            <label
              key={slot.value}
              className="relative flex min-h-11 cursor-pointer items-center justify-center rounded-control border border-line-strong/60 bg-surface px-2 text-sm font-medium tabular-nums text-ink transition-colors hover:border-ink-faint hover:bg-surface-2 has-checked:border-primary has-checked:bg-primary has-checked:text-on-primary has-focus-visible:ring-3 has-focus-visible:ring-focus/35"
            >
              <input
                className="sr-only"
                type="radio"
                name="scheduledAt"
                value={slot.value}
                defaultChecked={slot.value === selectedTime}
                required
              />
              {slot.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-5 border-t border-line pt-5">
        <Field label="Vehicle">
          <select
            className={`${bookingInput} pr-8`}
            name="vehicleId"
            value={vehicleId}
            onChange={(event) => setVehicleId(event.target.value)}
          >
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.label}
              </option>
            ))}
            <option value="">Add a vehicle</option>
          </select>
        </Field>
        {!vehicleId ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Make">
              <input
                name="make"
                required
                maxLength={80}
                className={bookingInput}
                placeholder="Toyota"
              />
            </Field>
            <Field label="Model">
              <input
                name="model"
                required
                maxLength={80}
                className={bookingInput}
                placeholder="RAV4"
              />
            </Field>
            <Field label="Year (optional)">
              <input name="year" type="number" min={1900} max={2100} className={bookingInput} />
            </Field>
          </div>
        ) : null}
        <Field label="Your contact phone">
          <input
            name="phone"
            type="tel"
            required
            defaultValue={phone}
            maxLength={40}
            autoComplete="tel"
            className={bookingInput}
          />
        </Field>
        <Field
          label="Where should we detail your vehicle?"
          hint="Street address, city and ZIP. Please check our service area above."
        >
          <textarea
            name="address"
            required
            minLength={8}
            maxLength={500}
            defaultValue={address}
            autoComplete="street-address"
            className={textareaClass}
          />
        </Field>
        <Field
          label="Water, power and parking"
          hint="Let us know about access to a hose, outlet and a safe place to work."
        >
          <textarea name="waterPowerNotes" maxLength={1000} className={textareaClass} />
        </Field>
        <Field label="Anything else? (optional)">
          <textarea
            name="customerNotes"
            maxLength={2000}
            className={textareaClass}
            placeholder="Pet hair, stains or other concerns."
          />
        </Field>
      </div>
      <label className="flex cursor-pointer items-start gap-3 rounded-control border border-line bg-surface-2 p-3.5 text-sm text-ink has-checked:border-accent-line has-checked:bg-accent-soft">
        <input type="checkbox" required className="mt-0.5 size-4 shrink-0" />
        <span className="min-w-0">I confirm this address is in the detailer's service area.</span>
      </label>
      <p className="flex items-start gap-2.5 text-sm leading-relaxed text-ink-muted">
        {request ? (
          <ClockIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
        ) : (
          <LightningIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-ink" />
        )}
        <span className="min-w-0">
          {request
            ? 'This is a request. Your time is confirmed after the detailer accepts it; availability can change before acceptance.'
            : 'Your appointment is confirmed immediately when this time is still available.'}{' '}
          Payment is arranged with your detailer.
        </span>
      </p>
    </BookingActionForm>
  )
}
