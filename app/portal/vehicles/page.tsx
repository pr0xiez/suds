import { savePortalVehicleAction } from '@/app/actions/bookings'
import { BookingActionForm } from '@/components/BookingActionForm'
import { bookingInput } from '@/components/bookingStyles'
import { Field } from '@/components/ui'
import { requirePortalUser } from '@/lib/bookingCustomer'
import { prisma } from '@/lib/db/client'

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
    <div>
      <h1 className="text-3xl font-bold">My vehicles</h1>
      <p className="mt-2 text-sm text-slate-600">
        Keep your vehicle details ready for the next appointment.
      </p>
      {!customers.length ? (
        <p className="mt-6 rounded-2xl bg-white p-6 text-sm text-slate-500">
          Your vehicle will appear here after your first booking or after accepting your detailer’s
          customer invitation.
        </p>
      ) : null}
      {customers.map((customer) => (
        <section className="mt-6" key={customer.id}>
          <h2 className="mb-4 text-lg font-semibold">With {customer.business.name}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {[...customer.vehicles, { id: '', make: '', model: '', year: null, color: '' }].map(
              (vehicle) => (
                <article
                  key={vehicle.id || 'new'}
                  className="rounded-2xl border border-emerald-900/10 bg-white p-5"
                >
                  <h3 className="mb-4 font-semibold">
                    {vehicle.id ? `${vehicle.make} ${vehicle.model}` : 'Add a vehicle'}
                  </h3>
                  <BookingActionForm
                    action={savePortalVehicleAction}
                    label={vehicle.id ? 'Save vehicle' : 'Add vehicle'}
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
