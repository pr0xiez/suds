/**
 * Money is integer cents everywhere. Formatting happens at the edge; parsing
 * happens once, at the form boundary.
 */

const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

export function formatCents(cents: number): string {
  return usd.format(cents / 100)
}

const MAX_CENTS = 100_000_000

/** "80", "$80", "80.5", "1,250.00" → cents. Returns null for anything else. */
export function parseMoneyToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, '').replaceAll(',', '')
  if (cleaned === '') return null
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  const value = Number(cleaned)
  const cents = Math.round(value * 100)
  // Amounts are stored in 32-bit integer columns; a million dollars is far past any job.
  if (!Number.isSafeInteger(cents) || cents > MAX_CENTS) return null
  return cents
}

export function sumCents(values: Array<{ priceCents: number }>): number {
  return values.reduce((total, item) => total + item.priceCents, 0)
}

/** Job total: line items minus discount, never below zero. Tip rides on top. */
export function jobTotalCents(job: {
  items: Array<{ priceCents: number }>
  discountCents: number
}): number {
  return Math.max(0, sumCents(job.items) - job.discountCents)
}
