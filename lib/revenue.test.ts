import { describe, expect, it } from 'vitest'
import { collectedSql, jobCollectedCents } from '@/lib/revenue'

describe('jobCollectedCents', () => {
  const items = [{ priceCents: 8000 }, { priceCents: 4500 }]
  it('is items minus discount plus tip', () => {
    expect(jobCollectedCents({ items, discountCents: 500, tipCents: 1000 })).toBe(13000)
  })
  it('clamps the discounted total at zero before adding the tip', () => {
    expect(jobCollectedCents({ items, discountCents: 99999, tipCents: 700 })).toBe(700)
    expect(jobCollectedCents({ items: [], discountCents: 0, tipCents: 0 })).toBe(0)
  })
  it('keeps the SQL twin on the same rule', () => {
    expect(collectedSql).toContain('GREATEST(0,')
    expect(collectedSql).toContain('SUM(i."priceCents")')
    expect(collectedSql).toContain('- j."discountCents")')
    expect(collectedSql).toContain('+ j."tipCents"')
  })
})
