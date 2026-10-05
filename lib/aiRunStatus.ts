/** Run statuses that are still being worked on; clients poll while any run is in one. */
export const IN_FLIGHT_STATUSES = ['QUEUED', 'SUBMITTING', 'PROCESSING'] as const

export function isInFlight(status: string): boolean {
  return (IN_FLIGHT_STATUSES as readonly string[]).includes(status)
}

/** Most photos one marketing draft or photo short may use. Enforced on client and server. */
export const MAX_RUN_PHOTOS = 8
/** Fewest photos a photo short needs. */
export const MIN_SHORT_PHOTOS = 2
