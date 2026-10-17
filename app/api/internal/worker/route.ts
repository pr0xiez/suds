import { timingSafeEqual } from 'node:crypto'
import { after } from 'next/server'
import { drainBackgroundWork } from '@/lib/workers'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'
const noStore = { 'Cache-Control': 'no-store' }
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET ?? ''
  if (secret.length < 32) return false
  const actual = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
function failed() {
  console.error(JSON.stringify({ event: 'worker_failed', time: new Date().toISOString() }))
}
/** Scheduled sweep (Vercel Cron) or a manual run: drains, then reports. */
export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    return Response.json(await drainBackgroundWork(), { headers: noStore })
  } catch {
    failed()
    return Response.json({ error: 'Worker unavailable.' }, { status: 503, headers: noStore })
  }
}
/** Kick from lib/workers/kick: work was just queued. Acknowledge now, drain after the response. */
export async function POST(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  after(() => drainBackgroundWork().catch(failed))
  return Response.json({ accepted: true }, { status: 202, headers: noStore })
}
