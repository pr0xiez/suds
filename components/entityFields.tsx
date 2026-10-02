import { Field, inputClass, textareaClass } from '@/components/ui'
import type { Customer, Vehicle } from '@/lib/generated/prisma/client'

/**
 * Shared field sets for the create and edit forms of customers and vehicles.
 * Columns follow the width of the card they sit in (container queries), so the
 * same fields work in a full-width form and in a narrow side column.
 */

export function CustomerFields({ defaults }: { defaults?: Customer | null }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-5 @md:grid-cols-2">
        <Field label="Name">
          <input name="name" defaultValue={defaults?.name} required className={inputClass} />
        </Field>
        <Field label="Phone">
          <input name="phone" type="tel" defaultValue={defaults?.phone} className={inputClass} />
        </Field>
        <Field label="Email">
          <input name="email" type="email" defaultValue={defaults?.email} className={inputClass} />
        </Field>
        <Field label="Address">
          <input name="address" defaultValue={defaults?.address} className={inputClass} />
        </Field>
        <Field label="Notes" className="@md:col-span-2">
          <textarea name="notes" defaultValue={defaults?.notes} className={textareaClass} />
        </Field>
      </div>
    </div>
  )
}

export function VehicleFields({ defaults }: { defaults?: Vehicle | null }) {
  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-4 @3xs:grid-cols-2 @lg:grid-cols-3">
        <Field label="Year">
          <input
            name="year"
            type="number"
            min={1900}
            max={2100}
            defaultValue={defaults?.year ?? ''}
            className={inputClass}
          />
        </Field>
        <Field label="Make">
          <input name="make" defaultValue={defaults?.make} required className={inputClass} />
        </Field>
        <Field label="Model">
          <input name="model" defaultValue={defaults?.model} required className={inputClass} />
        </Field>
        <Field label="Color">
          <input name="color" defaultValue={defaults?.color} className={inputClass} />
        </Field>
        <Field label="Plate">
          <input
            name="plate"
            defaultValue={defaults?.plate}
            className={`${inputClass} font-mono`}
          />
        </Field>
        <Field label="Notes">
          <input name="notes" defaultValue={defaults?.notes} className={inputClass} />
        </Field>
      </div>
    </div>
  )
}
