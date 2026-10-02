import { describe, expect, it } from 'vitest'
import {
  type BookingView,
  bookingViewChanged,
  type CatalogService,
  deriveDuration,
  type JobLine,
  reconcileJobLines,
  serviceLines,
  storedDurationOverride,
} from '@/lib/jobLines'

const catalogOf = (...services: CatalogService[]) =>
  new Map(services.map((service) => [service.id, service]))

// Booked at the old rates; the catalog has since been renamed, repriced and lengthened.
const full: JobLine = {
  serviceId: 'full',
  name: 'Full detail',
  priceCents: 12500,
  durationMin: 60,
  sort: 0,
}
const wax: JobLine = { serviceId: 'wax', name: 'Wax', priceCents: 4000, durationMin: 30, sort: 1 }
const pet: JobLine = {
  serviceId: null,
  name: 'Pet hair',
  priceCents: 2500,
  durationMin: 15,
  sort: 2,
}
const booked = [full, wax, pet]
const petHair = { name: 'Pet hair', priceCents: 2500, durationMin: 15 }
const catalog = catalogOf(
  { id: 'full', name: 'Full detail (2026)', priceCents: 15000, durationMin: 90 },
  { id: 'wax', name: 'Wax', priceCents: 5000, durationMin: 45 },
  { id: 'tires', name: 'Tire shine', priceCents: 1500, durationMin: 10 },
)
const tires = { serviceId: 'tires', name: 'Tire shine', priceCents: 1500, durationMin: 10 }

describe('reconcileJobLines', () => {
  it('keeps the booked snapshot of unchanged lines after catalog price and duration changes', () => {
    expect(reconcileJobLines(booked, ['full', 'wax'], [petHair], catalog)).toEqual(booked)
  })

  it('snapshots the current catalog only for a newly added service', () => {
    expect(reconcileJobLines(booked, ['full', 'wax', 'tires'], [petHair], catalog)).toEqual([
      full,
      wax,
      { ...tires, sort: 2 },
      { ...pet, sort: 3 },
    ])
  })

  it('drops a removed service and renumbers what remains', () => {
    expect(reconcileJobLines(booked, ['wax'], [], catalog)).toEqual([{ ...wax, sort: 0 }])
  })

  it('matches repeated services as a multiset', () => {
    const second = { ...wax, priceCents: 4200, durationMin: 35, sort: 1 }
    const twice = [{ ...wax, sort: 0 }, second]
    expect(reconcileJobLines(twice, ['wax', 'wax'], [], catalog)).toEqual(twice)
    expect(reconcileJobLines(twice, ['wax'], [], catalog)).toEqual([{ ...wax, sort: 0 }])
    expect(reconcileJobLines(twice, ['wax', 'wax', 'wax'], [], catalog)).toEqual([
      ...twice,
      { serviceId: 'wax', name: 'Wax', priceCents: 5000, durationMin: 45, sort: 2 },
    ])
  })

  it('keeps a service that left the active catalog at its snapshot, but never adds one', () => {
    const withoutWax = catalogOf(
      { id: 'full', name: 'Full detail', priceCents: 15000, durationMin: 90 },
      { id: 'tires', name: 'Tire shine', priceCents: 1500, durationMin: 10 },
    )
    expect(reconcileJobLines(booked, ['full', 'wax'], [petHair], withoutWax)).toEqual(booked)
    expect(() => reconcileJobLines(booked, ['full', 'wax', 'wax'], [], withoutWax)).toThrow(
      'Unknown service',
    )
    expect(() => reconcileJobLines([], ['wax'], [], withoutWax)).toThrow('Unknown service')
  })

  it('passes custom lines through as submitted, after catalog lines', () => {
    const edited = { name: 'Pet hair', priceCents: 3000, durationMin: 20 }
    expect(reconcileJobLines(booked, ['full'], [edited, petHair], catalog)).toEqual([
      full,
      { serviceId: null, ...edited, sort: 1 },
      { ...pet, sort: 2 },
    ])
  })

  it('keeps booked order whatever the selection order, with added lines after', () => {
    const lines = reconcileJobLines(booked, ['tires', 'wax', 'full'], [petHair], catalog)
    expect(lines).toEqual([full, wax, { ...tires, sort: 2 }, { ...pet, sort: 3 }])
    expect(reconcileJobLines(lines, ['wax', 'tires', 'full'], [petHair], catalog)).toEqual(lines)
  })

  it('snapshots the current catalog for a new job', () => {
    expect(reconcileJobLines([], ['wax', 'full'], [], catalog)).toEqual([
      { serviceId: 'wax', name: 'Wax', priceCents: 5000, durationMin: 45, sort: 0 },
      {
        serviceId: 'full',
        name: 'Full detail (2026)',
        priceCents: 15000,
        durationMin: 90,
        sort: 1,
      },
    ])
    expect(() => reconcileJobLines([], [], [], catalog)).toThrow('at least one')
  })

  it('never matches a booked custom line, and reports what the catalog lacks', () => {
    expect(serviceLines([pet], ['wax', 'gone'], catalog)).toEqual({
      lines: [{ serviceId: 'wax', name: 'Wax', priceCents: 5000, durationMin: 45 }],
      unavailable: ['gone'],
    })
  })
})

describe('bookingViewChanged', () => {
  const view: BookingView = {
    scheduledAt: new Date('2026-10-05T14:00:00.000Z'),
    durationMin: 105,
    priceCents: 19000,
    address: '1 Main St',
    waterPowerNotes: '',
    customerNotes: 'Gate code 1234',
    lines: booked,
  }

  it('ignores catalog linkage and line order, which the customer cannot see', () => {
    expect(bookingViewChanged(view, { ...view })).toBe(false)
    expect(
      bookingViewChanged(view, { ...view, lines: [pet, full, { ...wax, serviceId: null }] }),
    ).toBe(false)
  })

  it('flags each customer-facing change', () => {
    const changes: Partial<BookingView>[] = [
      { scheduledAt: new Date('2026-10-05T14:30:00.000Z') },
      { durationMin: 120 },
      { priceCents: 18000 },
      { address: '2 Main St' },
      { waterPowerNotes: 'Outlet by garage' },
      { customerNotes: 'Gate code 5678' },
      { lines: [full, wax] },
      { lines: [full, wax, pet, pet] },
      { lines: [full, { ...wax, priceCents: 4001 }, pet] },
      { lines: [full, { ...wax, durationMin: 31 }, pet] },
      { lines: [full, { ...wax, name: 'Ceramic wax' }, pet] },
    ]
    for (const change of changes)
      expect(bookingViewChanged(view, { ...view, ...change })).toBe(true)
  })

  it('treats an unreadable stored snapshot as changed so the sync rewrites it', () => {
    expect(bookingViewChanged({ ...view, lines: null }, view)).toBe(true)
  })
})

describe('job duration', () => {
  const minutes = (...durations: number[]) => durations.map((durationMin) => ({ durationMin }))

  it('uses an override of at least 15 minutes, else the lines with a 30-minute floor', () => {
    expect(deriveDuration(120, minutes(60))).toBe(120)
    expect(deriveDuration(15, minutes(60))).toBe(15)
    expect(deriveDuration(null, minutes(60, 30))).toBe(90)
    expect(deriveDuration(null, minutes(15))).toBe(30)
    expect(deriveDuration(10, minutes(60))).toBe(60)
  })

  it('leaves the edit override blank when the stored lines derive the stored length', () => {
    expect(storedDurationOverride(60, minutes(60))).toBeNull()
    expect(storedDurationOverride(90, minutes(60, 15, 15))).toBeNull()
    expect(storedDurationOverride(30, minutes(10, 5))).toBeNull()
  })

  it('keeps a length the lines would not derive, including a booked 15-minute job', () => {
    expect(storedDurationOverride(15, minutes(15))).toBe(15)
    expect(storedDurationOverride(120, minutes(60))).toBe(120)
    expect(storedDurationOverride(45, minutes(60))).toBe(45)
    expect(storedDurationOverride(2880, minutes())).toBe(2880)
    // A kept override still governs until the owner clears it.
    expect(deriveDuration(storedDurationOverride(15, minutes(15)), minutes(15, 60))).toBe(15)
  })

  it('saves an untouched form at the stored length and follows the lines once they change', () => {
    for (const [stored, lines] of [
      [60, minutes(60)],
      [15, minutes(15)],
      [120, minutes(60)],
      [30, minutes(10)],
    ] as const)
      expect(deriveDuration(storedDurationOverride(stored, lines), lines)).toBe(stored)
    const override = storedDurationOverride(60, minutes(60))
    expect(deriveDuration(override, minutes(60, 60))).toBe(120)
    expect(deriveDuration(override, minutes(45))).toBe(45)
  })
})
