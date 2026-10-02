import { CarProfileIcon, PlusIcon } from '@phosphor-icons/react/ssr'
import clsx from 'clsx'
import { savePortalVehicleAction } from '@/app/actions/bookings'
import { BookingActionForm } from '@/components/BookingActionForm'
import { bookingInput } from '@/components/bookingStyles'
import { btnSecondary, EmptyState, Field, PageHeader } from '@/components/ui'
import { requirePortalUser } from '@/lib/bookingCustomer'
import { prisma } from '@/lib/db/client'

const secondaryButton = clsx(btnSecondary, 'min-h-11! px-5!')

export default async function PortalVehiclesPage() {
  const user = await requirePortalUser('/portal/vehicles')
  const customers = await prisma.customer.findMany({
    where: { userId: user.id },
    select: {
      id: true,
      business: { select: { name: true } },
      vehicles: { select: { id: true, make: true, model: true, year: true, color: true } },
    },
  })
  return (
    <div data-portal-section="vehicles">
      <PageHeader
        title="My vehicles"
        subtitle="Keep your vehicle details ready for the next appointment."
      />
      {!customers.length ? (
        <EmptyState
          icon={CarProfileIcon}
          title="No vehicles yet"
          hint="Your vehicle will appear here after your first booking or after accepting your detailer’s customer invitation."
        />
      ) : null}
      {customers.map((customer) => (
        <section className="mt-10 first-of-type:mt-0" key={customer.id}>
          <h2 className="text-base font-semibold text-ink">With {customer.business.name}</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {[...customer.vehicles, { id: '', make: '', model: '', year: null, color: '' }].map(
              (vehicle) => (
                <article
                  key={vehicle.id || 'new'}
                  className={clsx(
                    'min-w-0 rounded-panel border p-5',
                    vehicle.id
                      ? 'border-line bg-surface shadow-panel'
                      : 'border-dashed border-line-strong/60 bg-surface/60',
                  )}
                >
                  <h3 className="mb-4 flex items-center gap-2 font-semibold text-ink">
                    {vehicle.id ? (
                      <CarProfileIcon aria-hidden className="size-5 shrink-0 text-ink-muted" />
                    ) : (
                      <PlusIcon aria-hidden className="size-5 shrink-0 text-accent-ink" />
                    )}
                    <span className="min-w-0 truncate">
                      {vehicle.id ? `${vehicle.make} ${vehicle.model}` : 'Add a vehicle'}
                    </span>
                  </h3>
                  <BookingActionForm
                    action={savePortalVehicleAction}
                    label={vehicle.id ? 'Save vehicle' : 'Add vehicle'}
                    icon={vehicle.id ? undefined : <PlusIcon aria-hidden />}
                    submitClassName={vehicle.id ? secondaryButton : undefined}
                  >
                    <input name="customerId" type="hidden" value={customer.id} />
                    <input name="id" type="hidden" value={vehicle.id} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Make">
                        <input
                          className={bookingInput}
                          name="make"
                          defaultValue={vehicle.make}
                          required
                          maxLength={80}
                        />
                      </Field>
                      <Field label="Model">
                        <input
                          className={bookingInput}
                          name="model"
                          defaultValue={vehicle.model}
                          required
                          maxLength={80}
                        />
                      </Field>
                      <Field label="Year">
                        <input
                          className={bookingInput}
                          name="year"
                          type="number"
                          min={1900}
                          max={2100}
                          defaultValue={vehicle.year ?? ''}
                        />
                      </Field>
                      <Field label="Color">
                        <input
                          className={bookingInput}
                          name="color"
                          defaultValue={vehicle.color}
                          maxLength={80}
                        />
                      </Field>
                    </div>
                  </BookingActionForm>
                </article>
              ),
            )}
          </div>
        </section>
      ))}
    </div>
  )
}
