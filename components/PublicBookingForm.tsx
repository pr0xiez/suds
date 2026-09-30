'use client'

import { useState } from 'react'
import { bookAppointmentAction } from '@/app/actions/bookings'
import { BookingActionForm } from '@/components/BookingActionForm'
import { bookingInput } from '@/components/bookingStyles'
import { Field } from '@/components/ui'

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
    >
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="serviceId" value={serviceId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-emerald-950">Choose your time</legend>
        <div className="grid max-h-72 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
          {slots.map((slot) => (
            <label
              key={slot.value}
              className="cursor-pointer rounded-xl border border-emerald-900/15 bg-white p-3 text-sm has-checked:border-emerald-700 has-checked:bg-emerald-50"
            >
              <input
                className="mr-2 accent-emerald-800"
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
      <Field label="Vehicle">
        <select
          className={bookingInput}
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
      <Field label="Where should we detail your vehicle?">
        <textarea
          name="address"
          required
          minLength={8}
          maxLength={500}
          defaultValue={address}
          autoComplete="street-address"
          className={bookingInput}
          placeholder="Street address, city and ZIP. Please check our service area above."
        />
      </Field>
      <Field label="Water, power and parking">
        <textarea
          name="waterPowerNotes"
          maxLength={1000}
          className={bookingInput}
          placeholder="Let us know about access to a hose, outlet and a safe place to work."
        />
      </Field>
      <Field label="Anything else? (optional)">
        <textarea
          name="customerNotes"
          maxLength={2000}
          className={bookingInput}
          placeholder="Pet hair, stains or other concerns."
        />
      </Field>
      <label className="flex items-start gap-2 text-sm text-slate-600">
        <input type="checkbox" required className="mt-1 accent-emerald-800" />I confirm this address
        is in the detailer's service area.
      </label>
      <p className="text-xs leading-relaxed text-slate-500">
        {request
          ? 'This is a request. Your time is confirmed after the detailer accepts it; availability can change before acceptance.'
          : 'Your appointment is confirmed immediately when this time is still available.'}{' '}
        Payment is arranged with your detailer.
      </p>
    </BookingActionForm>
  )
}
