/**
 * Pure layout math for the week schedule: overlapping jobs in a day column are
 * placed side by side in "lanes", sized against a fixed display window.
 */

export interface TimeSpan {
  startMin: number
  endMin: number
}

export interface Positioned<T> {
  item: T
  /** 0-based column within the overlap cluster. */
  lane: number
  /** Total lanes in this item's overlap cluster — divide the width by this. */
  lanes: number
}

/**
 * Greedy interval layout: sort by start, give each item the lowest lane that is
 * free at its start, and size every member of a transitive-overlap cluster to
 * the cluster's lane count.
 */
export function assignLanes<T extends TimeSpan>(items: readonly T[]): Positioned<T>[] {
  const sorted = [...items].sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)
  const result: Positioned<T>[] = []

  let cluster: Positioned<T>[] = []
  let laneEnds: number[] = []
  let clusterEnd = Number.NEGATIVE_INFINITY

  const closeCluster = () => {
    for (const positioned of cluster) positioned.lanes = laneEnds.length
    result.push(...cluster)
    cluster = []
    laneEnds = []
    clusterEnd = Number.NEGATIVE_INFINITY
  }

  for (const item of sorted) {
    if (cluster.length > 0 && item.startMin >= clusterEnd) closeCluster()

    let lane = laneEnds.findIndex((end) => end <= item.startMin)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(item.endMin)
    } else {
      laneEnds[lane] = item.endMin
    }
    cluster.push({ item, lane, lanes: 0 })
    clusterEnd = Math.max(clusterEnd, item.endMin)
  }
  closeCluster()

  return result
}

// The visible day window on the schedule. Jobs outside it are clamped to the
// edge rather than dropped, so an early or late booking is still visible.
export const DAY_START_MIN = 7 * 60
export const DAY_END_MIN = 20 * 60
const WINDOW_MIN = DAY_END_MIN - DAY_START_MIN
const MIN_CHIP_MIN = 20

/** Percent offsets for a span within the display window. */
export function spanToPct(span: TimeSpan): { top: number; height: number } {
  const start = Math.min(Math.max(span.startMin, DAY_START_MIN), DAY_END_MIN - MIN_CHIP_MIN)
  const end = Math.min(Math.max(span.endMin, start + MIN_CHIP_MIN), DAY_END_MIN)
  return {
    top: ((start - DAY_START_MIN) / WINDOW_MIN) * 100,
    height: ((end - start) / WINDOW_MIN) * 100,
  }
}

export function windowHours(): number[] {
  const hours: number[] = []
  for (let h = DAY_START_MIN / 60; h < DAY_END_MIN / 60; h++) hours.push(h)
  return hours
}

export function hourLabel(hour: number): string {
  const h12 = hour % 12 === 0 ? 12 : hour % 12
  return `${h12} ${hour < 12 ? 'AM' : 'PM'}`
}
