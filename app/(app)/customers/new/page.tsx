import { createCustomerAction } from '@/app/actions/customers'
import { CustomerFields } from '@/components/entityFields'
import { btnPrimary, Card, PageHeader } from '@/components/ui'
import { requireUser } from '@/lib/auth/session'

export const metadata = { title: 'New customer' }

export default async function NewCustomerPage() {
  await requireUser()
  return (
    <div className="max-w-2xl">
      <PageHeader title="New customer" subtitle="You can add their vehicles right after" />
      <Card>
        <form action={createCustomerAction} className="space-y-4">
          <CustomerFields />
          <button type="submit" className={btnPrimary}>
            Create customer
          </button>
        </form>
      </Card>
    </div>
  )
}
