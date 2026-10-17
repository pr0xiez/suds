import { afterEach, describe, expect, it, vi } from 'vitest'

const scheduled = vi.hoisted(() => [] as Array<() => Promise<void>>)
const nextServer = vi.hoisted(() => ({
  inRequest: true,
  after: vi.fn((task: () => Promise<void>) => {
    if (!nextServer.inRequest) throw new Error('`after` was called outside a request scope.')
    scheduled.push(task)
  }),
}))
vi.mock('next/server', () => ({ after: nextServer.after }))
const drain = vi.hoisted(() => vi.fn(async () => ({ ticks: 1 })))
vi.mock('@/lib/workers', () => ({ drainBackgroundWork: drain }))
vi.mock('@/lib/db/client', () => ({ prisma: {} }))

import { kickIfAnyDue, kickWorker } from './kick'

const SECRET = 'x'.repeat(40)
async function runScheduled() {
  for (const task of scheduled.splice(0)) await task()
}
function production() {
  vi.stubEnv('VERCEL', '1')
  vi.stubEnv('VERCEL_ENV', 'production')
  vi.stubEnv('CRON_SECRET', SECRET)
  vi.stubEnv('PUBLIC_APP_URL', 'https://suds.example.test')
}

afterEach(() => {
  scheduled.length = 0
  nextServer.inRequest = true
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('kickWorker', () => {
  it('posts an authenticated kick to the production worker after the response', async () => {
    production()
    const fetch = vi.fn(async () => new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetch)
    kickWorker()
    expect(fetch).not.toHaveBeenCalled()
    await runScheduled()
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.toString()).toBe('https://suds.example.test/api/internal/worker')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({ Authorization: `Bearer ${SECRET}` })
    expect(drain).not.toHaveBeenCalled()
  })

  it('sends the deployment protection bypass when Vercel provides one', async () => {
    production()
    vi.stubEnv('VERCEL_AUTOMATION_BYPASS_SECRET', 'bypass-value')
    const fetch = vi.fn(async () => new Response(null, { status: 202 }))
    vi.stubGlobal('fetch', fetch)
    kickWorker()
    await runScheduled()
    const [, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit]
    expect(init.headers).toMatchObject({ 'x-vercel-protection-bypass': 'bypass-value' })
  })

  it('never processes background work from a Vercel preview', async () => {
    production()
    vi.stubEnv('VERCEL_ENV', 'preview')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    kickWorker()
    await runScheduled()
    expect(fetch).not.toHaveBeenCalled()
    expect(drain).not.toHaveBeenCalled()
  })

  it('does not call the worker without a usable secret', async () => {
    production()
    vi.stubEnv('CRON_SECRET', 'short')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    kickWorker()
    await runScheduled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('swallows an unreachable worker; the scheduled sweep remains the backstop', async () => {
    production()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('fetch failed')
      }),
    )
    kickWorker()
    await expect(runScheduled()).resolves.toBeUndefined()
  })

  it('drains in-process on a long-lived server outside Vercel', async () => {
    vi.stubEnv('VERCEL', '')
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    kickWorker()
    await runScheduled()
    expect(drain).toHaveBeenCalledTimes(1)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('is a no-op outside a request, such as in scripts', () => {
    nextServer.inRequest = false
    expect(() => kickWorker()).not.toThrow()
    expect(scheduled).toHaveLength(0)
  })

  it('never kicks inside the isolated demo, which has its own simulated worker', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('SUDS_DEMO_MODE', '1')
    vi.stubEnv('DATABASE_URL', 'postgresql://u:p@localhost/db?schema=suds_demo_0123456789ab')
    kickWorker()
    expect(nextServer.after).not.toHaveBeenCalled()
  })
})

describe('kickIfAnyDue', () => {
  const now = Date.now()
  const run = (status: string, nextAttemptAt: number, lockedAt: number | null = null) => ({
    status,
    nextAttemptAt: new Date(nextAttemptAt),
    lockedAt: lockedAt === null ? null : new Date(lockedAt),
  })

  it('kicks for a queued or processing run that is due and unleased', () => {
    kickIfAnyDue([run('COMPLETED', now - 1000), run('PROCESSING', now - 1000)])
    expect(nextServer.after).toHaveBeenCalledTimes(1)
  })

  it('kicks when a crashed worker’s lease has expired', () => {
    kickIfAnyDue([run('PROCESSING', now - 1000, now - 301_000)])
    expect(nextServer.after).toHaveBeenCalledTimes(1)
  })

  it('leaves runs alone that are finished, waiting for their retry, or leased', () => {
    kickIfAnyDue([
      run('COMPLETED', now - 1000),
      run('FAILED', now - 1000),
      run('PROCESSING', now + 30_000),
      run('PROCESSING', now - 1000, now - 10_000),
    ])
    expect(nextServer.after).not.toHaveBeenCalled()
  })
})
