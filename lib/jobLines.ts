// Type aliases, not interfaces: lines are also stored as booking JSON snapshots.

/** A job line's stored values: a catalog snapshot (serviceId set) or a custom line (null). */
export type LineSnapshot = {
  serviceId: string | null
  name: string
  priceCents: number
  durationMin: number
}

export type JobLine = LineSnapshot & { sort: number }

export type ServiceLine = LineSnapshot & { serviceId: string }

/** A service the current catalog offers for new lines. */
export interface CatalogService {
  id: string
  name: string
  priceCents: number
  durationMin: number
}

export interface CustomLineInput {
  name: string
  priceCents: number
  durationMin: number
}

/**
 * Catalog lines for the selected service ids. A service already on the job keeps its booked
 * line, matched as a multiset, so catalog edits or deactivation never reprice it. Only other ids
 * snapshot `catalog`; ids it lacks are returned as `unavailable`. Kept lines stay in their booked
 * order, ahead of added ones in selection order.
 */
export function serviceLines(
  booked: readonly LineSnapshot[],
  serviceIds: readonly string[],
  catalog: ReadonlyMap<string, CatalogService>,
): { lines: ServiceLine[]; unavailable: string[] } {
  const pool = new Map<string, Array<{ at: number; line: ServiceLine }>>()
  booked.forEach((line, at) => {
    const { serviceId } = line
    if (serviceId === null) return
    const entries = pool.get(serviceId) ?? []
    entries.push({
      at,
      line: {
        serviceId,
        name: line.name,
        priceCents: line.priceCents,
        durationMin: line.durationMin,
      },
    })
    pool.set(serviceId, entries)
  })
  const kept: Array<{ at: number; line: ServiceLine }> = []
  const added: ServiceLine[] = []
  const unavailable: string[] = []
  for (const id of serviceIds) {
    const match = pool.get(id)?.shift()
    if (match) {
      kept.push(match)
      continue
    }
    const service = catalog.get(id)
    if (service)
      added.push({
        serviceId: service.id,
        name: service.name,
        priceCents: service.priceCents,
        durationMin: service.durationMin,
      })
    else unavailable.push(id)
  }
  const lines = kept.sort((a, b) => a.at - b.at).map(({ line }) => line)
  return { lines: [...lines, ...added], unavailable }
}

/**
 * The lines a save stores: catalog lines from `serviceLines`, then custom lines as submitted,
 * numbered in that order. `booked` is the job's current lines in sort order (empty for a new
 * job); `catalog` holds only active services of the job's business, so the client never prices
 * a catalog line and cannot add a retired or foreign service.
 */
export function reconcileJobLines(
  booked: readonly LineSnapshot[],
  serviceIds: readonly string[],
  customLines: readonly CustomLineInput[],
  catalog: ReadonlyMap<string, CatalogService>,
): JobLine[] {
  const { lines, unavailable } = serviceLines(booked, serviceIds, catalog)
  if (unavailable.length > 0) throw new Error('Unknown service on job')
  const all: LineSnapshot[] = [
    ...lines,
    ...customLines.map((line) => ({
      serviceId: null,
      name: line.name,
      priceCents: line.priceCents,
      durationMin: line.durationMin,
    })),
  ]
  if (all.length === 0) throw new Error('A job needs at least one service or line item')
  return all.map((line, sort) => ({ ...line, sort }))
}

/** What a linked booking shows its customer; `lines` is null when the stored copy is unreadable. */
export interface BookingView {
  scheduledAt: Date
  durationMin: number
  priceCents: number
  address: string
  waterPowerNotes: string
  customerNotes: string
  lines: readonly LineSnapshot[] | null
}

/**
 * Whether syncing an owner edit changes what the customer was told. Lines compare by name, price
 * and duration as a multiset: catalog linkage and line order alone are not worth a notice.
 */
export function bookingViewChanged(before: BookingView, after: BookingView): boolean {
  const lineKeys = (lines: readonly LineSnapshot[]) =>
    lines
      .map((line) => JSON.stringify([line.name, line.priceCents, line.durationMin]))
      .sort()
      .join('\n')
  return (
    before.scheduledAt.getTime() !== after.scheduledAt.getTime() ||
    before.durationMin !== after.durationMin ||
    before.priceCents !== after.priceCents ||
    before.address !== after.address ||
    before.waterPowerNotes !== after.waterPowerNotes ||
    before.customerNotes !== after.customerNotes ||
    before.lines === null ||
    after.lines === null ||
    lineKeys(before.lines) !== lineKeys(after.lines)
  )
}
