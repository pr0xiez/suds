import { describe, expect, it } from 'vitest'
import { formatCents, jobTotalCents, parseMoneyToCents, sumCents } from '@/lib/money'

describe('formatCents', () => {
  it('formats dollars and cents', () => {
    expect(formatCents(0)).toBe('$0.00')
    expect(formatCents(12345)).toBe('$123.45')
    expect(formatCents(125000)).toBe('$1,250.00')
  })
})

describe('parseMoneyToCents', () => {
  it('accepts common human inputs', () => {
    expect(parseMoneyToCents('80')).toBe(8000)
    expect(parseMoneyToCents('$80')).toBe(8000)
    expect(parseMoneyToCents('80.5')).toBe(8050)
    expect(parseMoneyToCents('1,250.00')).toBe(125000)
    expect(parseMoneyToCents('  39.99 ')).toBe(3999)
    expect(parseMoneyToCents('0')).toBe(0)
  })

  it('rejects junk', () => {
    expect(parseMoneyToCents('')).toBeNull()
    expect(parseMoneyToCents('abc')).toBeNull()
    expect(parseMoneyToCents('1.234')).toBeNull()
    expect(parseMoneyToCents('-5')).toBeNull()
    expect(parseMoneyToCents('12.34.56')).toBeNull()
  })
})

describe('jobTotalCents', () => {
  it('sums items minus discount, floored at zero', () => {
    const items = [{ priceCents: 10000 }, { priceCents: 2500 }]
    expect(sumCents(items)).toBe(12500)
    expect(jobTotalCents({ items, discountCents: 500 })).toBe(12000)
    expect(jobTotalCents({ items, discountCents: 99999 })).toBe(0)
  })
})
