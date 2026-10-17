import { describe, expect, it, vi } from 'vitest'
import { createDrainer } from './drain'

/** A fake clock: waiting advances time, so loops run instantly and deterministically. */
function harness(options: {
  dueAt: Array<number | null>
  progressed?: boolean[]
  onTick?: (tick: number) => void
}) {
  let clock = 0
  let tick = 0
  const waits: number[] = []
  const deps = {
    now: () => clock,
    wait: vi.fn(async (ms: number) => {
      waits.push(ms)
      clock += ms
    }),
    tick: vi.fn(async () => {
      const current = tick++
      options.onTick?.(current)
      return { progressed: options.progressed?.[current] ?? false }
    }),
    nextDueAt: vi.fn(async () => {
      const due = options.dueAt[Math.min(tick - 1, options.dueAt.length - 1)]
      return due === null || due === undefined ? null : new Date(due)
    }),
  }
  return { deps, waits, drainer: createDrainer(deps) }
}

describe('drainBackgroundWork', () => {
  it('ticks once and stops when the queues are empty', async () => {
    const { deps, drainer } = harness({ dueAt: [null] })
    expect(await drainer.drain(240_000)).toEqual({
      ticks: 1,
      productiveTicks: 0,
      nextDueAt: null,
    })
    expect(deps.wait).not.toHaveBeenCalled()
  })

  it('keeps ticking while a backlog is due and each tick makes progress', async () => {
    const { deps, drainer } = harness({ dueAt: [0, 0, null], progressed: [true, true, false] })
    expect((await drainer.drain(240_000)).ticks).toBe(3)
    expect(deps.wait).not.toHaveBeenCalled()
  })

  it('sleeps until work due inside the budget, such as a render status check', async () => {
    const { waits, drainer } = harness({ dueAt: [60_000, null], progressed: [true, true] })
    const result = await drainer.drain(240_000)
    expect(waits).toEqual([60_000])
    expect(result.ticks).toBe(2)
  })

  it('stops instead of waiting for work due after the budget, like tomorrow’s reminder', async () => {
    const tomorrow = 86_400_000
    const { deps, drainer } = harness({ dueAt: [tomorrow] })
    const result = await drainer.drain(240_000)
    expect(result).toMatchObject({ ticks: 1, nextDueAt: new Date(tomorrow).toISOString() })
    expect(deps.wait).not.toHaveBeenCalled()
  })

  it('gives unclaimable due work one short retry, then stops rather than spinning', async () => {
    // e.g. email is not configured, so pending mail is due but never sent.
    const { waits, drainer } = harness({ dueAt: [0] })
    const result = await drainer.drain(240_000)
    expect(waits).toEqual([2_000])
    expect(result.ticks).toBe(2)
  })

  it('shares one drain per process and gives a kick that lands mid-tick its own tick', async () => {
    let second: Promise<unknown> | undefined
    const { deps, drainer } = harness({
      dueAt: [null],
      onTick: (tick) => {
        if (tick === 0) second = drainer.drain(240_000)
      },
    })
    const first = drainer.drain(240_000)
    expect(await first).toMatchObject({ ticks: 2 })
    expect(second).toBe(first)
    expect(deps.tick).toHaveBeenCalledTimes(2)
  })

  it('starts a fresh drain for a kick that arrives after the previous one finished', async () => {
    const { deps, drainer } = harness({ dueAt: [null] })
    await drainer.drain(240_000)
    await drainer.drain(240_000)
    expect(deps.tick).toHaveBeenCalledTimes(2)
  })

  it('releases the drain when a tick fails, so the next kick can run', async () => {
    const { deps, drainer } = harness({ dueAt: [null] })
    deps.tick.mockRejectedValueOnce(new Error('database unavailable'))
    await expect(drainer.drain(240_000)).rejects.toThrow('database unavailable')
    expect((await drainer.drain(240_000)).ticks).toBe(1)
  })

  it('wakes a sleeping drain when new work is kicked', async () => {
    let wake: (() => void) | undefined
    let tick = 0
    let clock = 0
    const drainer = createDrainer({
      now: () => clock,
      tick: async () => {
        tick++
        return { progressed: false }
      },
      nextDueAt: async () => (tick === 1 ? new Date(120_000) : null),
      wait: (ms, signal) =>
        new Promise<void>((resolve) => {
          wake = () => {
            clock += 1_000
            resolve()
          }
          signal.addEventListener('abort', () => wake?.())
          if (ms <= 0) resolve()
        }),
    })
    const running = drainer.drain(240_000)
    await vi.waitFor(() => expect(wake).toBeDefined())
    void drainer.drain(240_000)
    expect(await running).toMatchObject({ ticks: 2 })
    expect(clock).toBe(1_000)
  })
})
