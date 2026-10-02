'use client'

import { CaretRightIcon, StorefrontIcon } from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import { saveBookingSetupAction } from '@/app/actions/bookings'
import { BookingActionForm } from '@/components/BookingActionForm'
import {
  Badge,
  btnPrimary,
  Card,
  Field,
  inputClass,
  selectClass,
  textareaClass,
} from '@/components/ui'
import type { WorkingWindow } from '@/lib/bookingAvailability'

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

/** A time input that shares a row with its partner ("09:00 to 17:00"). */
const timeInput = clsx(inputClass, 'min-w-0 flex-1')

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
      className="flex flex-col gap-6"
      submitClassName={clsx(btnPrimary, 'self-end')}
    >
      <div id="booking-page" className="scroll-mt-6">
        <Card title="Your public booking page">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <Field label="Business name">
              <input
                className={inputClass}
                name="name"
                defaultValue={values.name}
                required
                minLength={2}
                maxLength={100}
              />
            </Field>
            <Field label="Booking link">
              <div className="flex">
                <span className="flex shrink-0 items-center rounded-l-control border border-r-0 border-line-strong bg-surface-2 px-3 font-mono text-sm text-ink-muted">
                  /b/
                </span>
                <input
                  className={clsx(inputClass, 'min-w-0 rounded-l-none! font-mono')}
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
                className={inputClass}
                name="phone"
                type="tel"
                defaultValue={values.phone}
                maxLength={40}
              />
            </Field>
            <Field label="Public contact email">
              <input className={inputClass} name="email" type="email" defaultValue={values.email} />
            </Field>
            <Field label="Service area" className="sm:col-span-2">
              <textarea
                className={textareaClass}
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
                className={inputClass}
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
              <select className={selectClass} name="bookingMode" defaultValue={values.bookingMode}>
                <option value="INSTANT">Confirm instantly (default)</option>
                <option value="REQUEST">Request owner approval</option>
              </select>
            </Field>
          </div>
          <p className="mt-5 border-t border-line pt-4 text-xs text-ink-muted">
            Approval requests do not reserve time. You confirm only after checking the request; Suds
            prevents conflicting appointments when you accept.
          </p>
        </Card>
      </div>

      <div id="hours" className="scroll-mt-6">
        <Card title="When can customers book?">
          <p className="mb-2 text-sm text-ink-muted">
            Set your local working hours. The whole service and travel buffer must fit. Add a second
            window to leave a lunch break.
          </p>
          <div className="divide-y divide-line">
            {days.map((name, day) => {
              const windows = workingHours.filter((window) => window.day === day)
              const first = windows[0]
              const second = windows[1]
              return (
                <fieldset key={name} className="py-3.5 last:pb-0">
                  <legend className="sr-only">{name}</legend>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
                    <label className="flex min-h-10 items-center gap-2.5 sm:w-36 sm:shrink-0">
                      <input
                        name={`open-${day}`}
                        type="checkbox"
                        defaultChecked={Boolean(first)}
                        className="size-4 shrink-0"
                      />
                      <span className="text-sm font-medium text-ink">{name}</span>
                      <span className="sr-only">open for bookings</span>
                    </label>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                      <input
                        name={`start-${day}`}
                        type="time"
                        aria-label={`${name} starts`}
                        defaultValue={first?.start ?? '09:00'}
                        className={timeInput}
                      />
                      <span className="shrink-0 text-sm text-ink-muted">to</span>
                      <input
                        name={`end-${day}`}
                        type="time"
                        aria-label={`${name} ends`}
                        defaultValue={first?.end ?? '17:00'}
                        className={timeInput}
                      />
                    </div>
                  </div>
                  <details className="group mt-2 sm:pl-40" open={Boolean(second)}>
                    <summary className="inline-flex min-h-8 cursor-pointer list-none items-center gap-1 text-xs font-medium text-accent-ink [&::-webkit-details-marker]:hidden">
                      <CaretRightIcon
                        aria-hidden
                        className="size-3.5 transition-transform group-open:rotate-90"
                      />
                      Second window / lunch break
                    </summary>
                    <div className="mt-2 space-y-3 rounded-control border border-line bg-surface-2/60 p-3">
                      <label className="flex items-center gap-2.5 text-sm text-ink">
                        <input
                          name={`split-${day}`}
                          type="checkbox"
                          defaultChecked={Boolean(second)}
                          className="size-4 shrink-0"
                        />
                        Use a second working window
                      </label>
                      <div className="flex min-w-0 items-center gap-2">
                        <input
                          name={`second-start-${day}`}
                          type="time"
                          aria-label={`${name} second window starts`}
                          defaultValue={second?.start ?? '13:00'}
                          className={timeInput}
                        />
                        <span className="shrink-0 text-sm text-ink-muted">to</span>
                        <input
                          name={`second-end-${day}`}
                          type="time"
                          aria-label={`${name} second window ends`}
                          defaultValue={second?.end ?? '17:00'}
                          className={timeInput}
                        />
                      </div>
                    </div>
                  </details>
                </fieldset>
              )
            })}
          </div>
        </Card>
      </div>

      <Card title="A schedule you can keep">
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <Field label="Travel buffer (minutes)">
            <input
              className={inputClass}
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
              className={inputClass}
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
              className={inputClass}
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
              className={inputClass}
              name="cancellationHours"
              type="number"
              min={0}
              max={168}
              defaultValue={values.cancellationHours}
              required
            />
          </Field>
        </div>
      </Card>

      <section
        id="publish"
        aria-labelledby="publish-heading"
        className={clsx(
          'scroll-mt-6 rounded-panel border p-4 shadow-panel sm:p-5',
          values.published ? 'border-line bg-surface' : 'border-accent-line bg-accent-soft',
        )}
      >
        <div className="flex items-start gap-3">
          <StorefrontIcon
            aria-hidden
            className={clsx(
              'mt-0.5 size-6 shrink-0',
              values.published ? 'text-ok' : 'text-accent-ink',
            )}
          />
          <div className="min-w-0 flex-1">
            <h2 id="publish-heading" className="font-semibold text-ink">
              Publish your booking page
            </h2>
            <p className="mt-1 text-sm text-ink-muted">
              Add your services and prices, set your hours, then publish your booking link.
            </p>
          </div>
          <Badge tone={values.published ? 'ok' : 'neutral'}>
            {values.published ? 'Published' : 'Draft'}
          </Badge>
        </div>
        <Field label="Booking page visibility" className="mt-4 sm:max-w-sm sm:pl-9">
          <select
            className={selectClass}
            name="publish"
            defaultValue={values.published ? 'yes' : 'no'}
          >
            <option value="no">Draft: finish setting up first</option>
            <option value="yes">Publish: customers can book</option>
          </select>
        </Field>
      </section>
    </BookingActionForm>
  )
}
