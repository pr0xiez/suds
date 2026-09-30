/** Structured operational events deliberately exclude customer data and provider payloads. */
export function logEvent(
  event: string,
  fields: { route?: string; count?: number; code?: string } = {},
) {
  console.info(JSON.stringify({ time: new Date().toISOString(), event, ...fields }))
}
