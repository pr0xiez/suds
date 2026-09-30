import { timingSafeEqual } from 'node:crypto'
import { runBackgroundWork } from '@/lib/workers'

export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'
function authorized(req: Request) {
  const secret = process.env.CRON_SECRET ?? ''
  if (secret.length < 32) return false
  const actual = Buffer.from(req.headers.get('authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  return actual.length === expected.length && timingSafeEqual(actual, expected)
}
export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'Unauthorized.' }, { status: 401 })
  try {
    return Response.json(await runBackgroundWork(), { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    console.error(JSON.stringify({ event: 'worker_failed', time: new Date().toISOString() }))
    return Response.json(
      { error: 'Worker unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
export async function POST(req: Request) {
  return GET(req)
}
