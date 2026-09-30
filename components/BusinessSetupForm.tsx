'use client'

import { saveBookingSetupAction } from '@/app/actions/bookings'
import { BookingActionForm } from '@/components/BookingActionForm'
import { bookingInput } from '@/components/bookingStyles'
import { Field } from '@/components/ui'
import type { WorkingWindow } from '@/lib/bookingAvailability'

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function BusinessSetupForm({
  values,
  workingHours,
}: {
  values: {
    name: string
    slug: string
    serviceArea: string
    timezone: string
    bookingMode: string
    phone: string
    email: string
    travelBufferMin: number
    leadTimeMin: number
    horizonDays: number
    cancellationHours: number
    published: boolean
  }
  workingHours: WorkingWindow[]
}) {
  return (
    <BookingActionForm
      action={saveBookingSetupAction}
      label="Save business setup"
      className="space-y-6"
    >
      <section className="rounded-2xl border border-emerald-900/10 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-emerald-950">Your public booking page</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Business name">
            <input
              className={bookingInput}
              name="name"
              defaultValue={values.name}
              required
              minLength={2}
              maxLength={100}
            />
          </Field>
          <Field label="Booking link">
            <div className="flex items-center gap-1">
              <span className="text-sm text-slate-500">/b/</span>
              <input
                className={bookingInput}
                name="slug"
                defaultValue={values.slug}
                required
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                minLength={3}
                maxLength={80}
              />
            </div>
          </Field>
          <Field label="Public contact phone">
            <input
              className={bookingInput}
              name="phone"
              type="tel"
              defaultValue={values.phone}
              maxLength={40}
            />
          </Field>
          <Field label="Public contact email">
            <input className={bookingInput} name="email" type="email" defaultValue={values.email} />
          </Field>
          <Field label="Service area" className="sm:col-span-2">
            <textarea
              className={bookingInput}
              name="serviceArea"
              defaultValue={values.serviceArea}
              required
              minLength={2}
              maxLength={1000}
              placeholder="Example: Cincinnati, Mason and West Chester. We come to your driveway."
            />
          </Field>
          <Field label="Business timezone">
            <input
              className={bookingInput}
              name="timezone"
              defaultValue={values.timezone}
              required
              list="business-timezones"
            />
            <datalist id="business-timezones">
              <option value="America/New_York" />
              <option value="America/Chicago" />
              <option value="America/Denver" />
              <option value="America/Los_Angeles" />
              <option value="America/Phoenix" />
              <option value="Pacific/Honolulu" />
            </datalist>
          </Field>
          <Field label="Customer booking mode">
            <select className={bookingInput} name="bookingMode" defaultValue={values.bookingMode}>
              <option value="INSTANT">Confirm instantly (default)</option>
              <option value="REQUEST">Request owner approval</option>
            </select>
          </Field>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Approval requests do not reserve time. You confirm only after checking the request; Suds
          prevents conflicting appointments when you accept.
        </p>
      </section>
      <section className="rounded-2xl border border-emerald-900/10 bg-white p-5 sm:p-6">
        <h2 className="text-lg font-semibold text-emerald-950">When can customers book?</h2>
        <p className="mt-1 mb-5 text-sm text-slate-500">
          Set your local working hours. The whole service and travel buffer must fit. Add a second
          window to leave a lunch break.
        </p>
        <div className="space-y-4">
          {days.map((name, day) => {
            const windows = workingHours.filter((window) => window.day === day)
            const first = windows[0]
            const second = windows[1]
            return (
              <fieldset key={name} className="rounded-xl border border-emerald-900/10 p-4">
                <legend className="px-1 text-sm font-semibold">{name}</legend>
                <label className="mb-3 flex items-center gap-2 text-sm">
                  <input
                    name={`open-${day}`}
                    type="checkbox"
                    defaultChecked={Boolean(first)}
                    className="accent-emerald-800"
                  />
                  Open for bookings
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Starts">
                    <input
                      name={`start-${day}`}
                      type="time"
                      defaultValue={first?.start ?? '09:00'}
                      className={bookingInput}
                    />
                  </Field>
                  <Field label="Ends">
                    <input
                      name={`end-${day}`}
                      type="time"
                      defaultValue={first?.end ?? '17:00'}
                      className={bookingInput}
                    />
                  </Field>
                </div>
                <details className="mt-3" open={Boolean(second)}>
                  <summary className="cursor-pointer text-xs font-semibold text-emerald-700">
                    Second window / lunch break
                  </summary>
                  <label className="my-3 flex items-center gap-2 text-sm">
                    <input name={`split-${day}`} type="checkbox" defaultChecked={Boolean(second)} />
                    Use a second working window
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Starts">
                      <input
                        name={`second-start-${day}`}
                        type="time"
                        defaultValue={second?.start ?? '13:00'}
                        className={bookingInput}
                      />
                    </Field>
                    <Field label="Ends">
                      <input
                        name={`second-end-${day}`}
                        type="time"
                        defaultValue={second?.end ?? '17:00'}
                        className={bookingInput}
                      />
                    </Field>
                  </div>
                </details>
              </fieldset>
            )
          })}
        </div>
      </section>
      <section className="rounded-2xl border border-emerald-900/10 bg-white p-5 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold text-emerald-950">A schedule you can keep</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Travel buffer (minutes)">
            <input
              className={bookingInput}
              name="travelBufferMin"
              type="number"
              min={0}
              max={240}
              defaultValue={values.travelBufferMin}
              required
            />
          </Field>
          <Field label="Minimum booking notice (minutes)">
            <input
              className={bookingInput}
              name="leadTimeMin"
              type="number"
              min={0}
              max={10080}
              defaultValue={values.leadTimeMin}
              required
            />
          </Field>
          <Field label="How far ahead? (days)">
            <input
              className={bookingInput}
              name="horizonDays"
              type="number"
              min={1}
              max={180}
              defaultValue={values.horizonDays}
              required
            />
          </Field>
          <Field label="Changes require notice (hours)">
            <input
              className={bookingInput}
              name="cancellationHours"
              type="number"
              min={0}
              max={168}
              defaultValue={values.cancellationHours}
              required
            />
          </Field>
        </div>
      </section>
      <section className="rounded-2xl bg-emerald-50 p-5">
        <Field label="Booking page visibility">
          <select
            className={bookingInput}
            name="publish"
            defaultValue={values.published ? 'yes' : 'no'}
          >
            <option value="no">Draft — finish setting up first</option>
            <option value="yes">Publish — customers can book</option>
          </select>
        </Field>
        <p className="mt-3 text-sm text-slate-600">
          Add your services and prices, set your hours, then publish your booking link.
        </p>
      </section>
    </BookingActionForm>
  )
}
