import { UserPlusIcon } from '@phosphor-icons/react/ssr'
import { createCustomerAction } from '@/app/actions/customers'
import { CustomerFields } from '@/components/entityFields'
import { btnPrimary, Card, PageHeader } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'

export const metadata = { title: 'New customer' }

export default async function NewCustomerPage() {
  await requireUser()
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="New customer"
        subtitle="You can add their vehicles right after."
        back={{ href: '/customers', label: 'Customers' }}
      />
      <Card>
        <form action={createCustomerAction} className="space-y-6">
          <CustomerFields />
          <div className="flex justify-end border-t border-line pt-5">
            <button type="submit" className={btnPrimary}>
              <UserPlusIcon aria-hidden />
              Create customer
            </button>
          </div>
        </form>
      </Card>
    </div>
  )
}
