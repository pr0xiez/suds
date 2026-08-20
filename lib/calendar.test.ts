import { describe, expect, it } from 'vitest'
import { assignLanes, DAY_END_MIN, DAY_START_MIN, spanToPct } from '@/lib/calendar'

const span = (startMin: number, endMin: number, id?: string) => ({ startMin, endMin, id })

describe('assignLanes', () => {
  it('handles empty input', () => {
    expect(assignLanes([])).toEqual([])
  })

  it('gives a lone job the full width', () => {
    const [only] = assignLanes([span(540, 600)])
    expect(only?.lane).toBe(0)
    expect(only?.lanes).toBe(1)
  })

  it('splits two overlapping jobs into two lanes', () => {
    const result = assignLanes([span(540, 660, 'a'), span(600, 720, 'b')])
    expect(result.map((r) => r.lanes)).toEqual([2, 2])
    expect(new Set(result.map((r) => r.lane))).toEqual(new Set([0, 1]))
  })

  it('keeps sequential jobs full-width', () => {
    const result = assignLanes([span(540, 600), span(600, 660)])
    expect(result.every((r) => r.lanes === 1 && r.lane === 0)).toBe(true)
  })

  it('sizes a transitive-overlap cluster together and reuses freed lanes', () => {
    // a(9-10) overlaps b(9:30-10:30); c(10-11) overlaps only b, reuses a's lane.
    const result = assignLanes([span(540, 600, 'a'), span(570, 630, 'b'), span(600, 660, 'c')])
    const byId = new Map(result.map((r) => [r.item.id, r]))
    expect(byId.get('a')?.lane).toBe(0)
    expect(byId.get('b')?.lane).toBe(1)
    expect(byId.get('c')?.lane).toBe(0)
    expect(result.every((r) => r.lanes === 2)).toBe(true)
  })

  it('separates independent clusters', () => {
    const result = assignLanes([span(480, 540, 'a'), span(500, 560, 'b'), span(700, 760, 'c')])
    const byId = new Map(result.map((r) => [r.item.id, r]))
    expect(byId.get('a')?.lanes).toBe(2)
    expect(byId.get('c')?.lanes).toBe(1)
  })
})

describe('spanToPct', () => {
  it('maps the window edges to 0% and 100%', () => {
    const full = spanToPct({ startMin: DAY_START_MIN, endMin: DAY_END_MIN })
    expect(full.top).toBe(0)
    expect(full.top + full.height).toBeCloseTo(100)
  })

  it('clamps spans that leak outside the window', () => {
    const early = spanToPct({ startMin: DAY_START_MIN - 120, endMin: DAY_START_MIN + 60 })
    expect(early.top).toBe(0)
    const late = spanToPct({ startMin: DAY_END_MIN + 30, endMin: DAY_END_MIN + 90 })
    expect(late.top + late.height).toBeCloseTo(100)
    expect(late.height).toBeGreaterThan(0)
  })
})
