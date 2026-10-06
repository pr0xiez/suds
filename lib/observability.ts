/** Structured operational events deliberately exclude customer data and provider payloads. */
export function logEvent(
  event: string,
  fields: { route?: string; count?: number; code?: string } = {},
) {
  console.info(JSON.stringify({ time: new Date().toISOString(), event, ...fields }))
}
/**
 * Failure events record only the error type (and a database error code when present), never the
 * message, which may carry customer data, provider payloads, or secrets. Ids are opaque.
 */
export function logFailure(
  event: string,
  err: unknown,
  fields: Record<string, string | number | undefined> = {},
) {
  const code =
    typeof err === 'object' && err !== null && 'code' in err && typeof err.code === 'string'
      ? err.code
      : undefined
  console.error(
    JSON.stringify({
      time: new Date().toISOString(),
      event,
      ...fields,
      name: err instanceof Error ? err.name : 'UnknownError',
      code,
    }),
  )
}
