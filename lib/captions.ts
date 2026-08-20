/**
 * Caption templating for social posts. Templates carry {{tokens}}; rendering is
 * plain substitution — unknown tokens become empty strings so a template never
 * throws. suggestCaption is deterministic (seeded by the vehicle string) so the
 * same job always suggests the same caption, and tests can pin outputs.
 */

export const CAPTION_TOKENS: Array<{ token: string; description: string }> = [
  { token: 'vehicle', description: 'Vehicle, e.g. "Black 2022 Tesla Model 3"' },
  { token: 'vehicleShort', description: 'Make + model, e.g. "Tesla Model 3"' },
  { token: 'services', description: 'Service list, e.g. "Full Detail + Pet Hair Removal"' },
  { token: 'service', description: 'The first (headline) service on the job' },
  { token: 'customer', description: "Customer's first name" },
  { token: 'business', description: 'Business name from Settings' },
  { token: 'city', description: 'City from Settings' },
  { token: 'phone', description: 'Phone from Settings' },
]

export function renderCaptionTemplate(body: string, context: Record<string, string>): string {
  return body
    .replace(/\{\{\s*([a-zA-Z][a-zA-Z0-9_]*)\s*\}\}/g, (_, key: string) => context[key] ?? '')
    .replace(/[ \t]+/g, ' ')
    .replace(/ +([.,!])/g, '$1')
    .trim()
}

export function describeVehicle(vehicle: {
  year?: number | null
  make: string
  model: string
  color?: string | null
}): string {
  return [vehicle.color, vehicle.year, vehicle.make, vehicle.model]
    .filter((part) => part !== null && part !== undefined && `${part}`.trim() !== '')
    .join(' ')
}

/** "A", "A + B", "A, B + C" — reads like a person wrote it. */
export function listServices(names: string[]): string {
  const cleaned = names.filter((n) => n.trim() !== '')
  if (cleaned.length === 0) return ''
  if (cleaned.length === 1) return cleaned[0] ?? ''
  return `${cleaned.slice(0, -1).join(', ')} + ${cleaned[cleaned.length - 1]}`
}

const SUGGESTION_PATTERNS = [
  '{{vehicle}} in for {{services}} — swipe for the before. ✨',
  'Another one out the door: {{services}} on this {{vehicle}}. 🧼',
  'This {{vehicleShort}} came in rough and left gleaming. {{services}}, done right.',
  'Fresh off the pad: {{vehicle}}. {{services}}.',
  '{{services}} on a {{vehicle}} — that end result speaks for itself. 🚗💨',
]

function stringSeed(input: string): number {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0
  }
  return hash
}

export function suggestCaption(context: Record<string, string>): string {
  const seed = stringSeed(context.vehicle ?? context.vehicleShort ?? 'suds')
  const pattern = SUGGESTION_PATTERNS[seed % SUGGESTION_PATTERNS.length] ?? SUGGESTION_PATTERNS[0]
  const body = renderCaptionTemplate(pattern ?? '', context)
  const cta =
    context.city && context.city !== ''
      ? `Book your detail in ${context.city} — link in bio.`
      : 'Book your detail — link in bio.'
  return `${body}\n\n${cta}`
}

/** Appends the hashtag bank (space-separated in Settings) on its own block. */
export function withHashtags(caption: string, hashtags: string): string {
  const tags = hashtags
    .split(/\s+/)
    .filter((t) => t !== '')
    .map((t) => (t.startsWith('#') ? t : `#${t}`))
  if (tags.length === 0) return caption
  return `${caption.trimEnd()}\n\n${tags.join(' ')}`
}

/** Instagram's caption ceiling — the composer shows a counter against this. */
export const CAPTION_MAX = 2200
