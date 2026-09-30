/** Demo conveniences must never expose a real application's accounts or outbox. */
export function demoEnabled(env: Readonly<Record<string, string | undefined>> = process.env) {
  if (!['development', 'test'].includes(env.NODE_ENV ?? '') || env.SUDS_DEMO_MODE !== '1')
    return false
  try {
    const schema = new URL(env.DATABASE_URL ?? '').searchParams.get('schema')
    return /^suds_demo_[a-f0-9]{12}$/.test(schema ?? '')
  } catch {
    return false
  }
}

// Deliberately public, fictional credentials. These accounts exist only in the disposable demo.
export const DEMO_PASSWORD = 'SudsDemo2026!'
export const DEMO_ACCOUNTS = {
  owner: { email: 'owner@suds.local', name: 'Alex · business owner', next: '/dashboard' },
  customer: { email: 'customer@suds.local', name: 'Marcus · customer', next: '/portal' },
  staff: { email: 'staff@suds.local', name: 'Jordan · staff', next: '/dashboard' },
} as const
