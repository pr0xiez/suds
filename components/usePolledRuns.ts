'use client'
import { useCallback, useEffect, useState } from 'react'
import { isInFlight } from '@/lib/aiRunStatus'

/**
 * Loads a run list once, then keeps polling only while a run is in flight.
 * Polling is keyed to the url, interval, and pause flag, never to form submits,
 * so submitting does not tear down and restart the loop. Add a new run with
 * `setRuns`; polling resumes by itself if that run is in flight.
 */
export function usePolledRuns<T extends { status: string }>(
  url: string,
  { intervalMs, paused = false }: { intervalMs: number; paused?: boolean },
) {
  const [runs, setRuns] = useState<T[]>([])
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  const active = runs.some((item) => isInFlight(item.status))
  const refresh = useCallback(() => setTick((n) => n + 1), [])

  // biome-ignore lint/correctness/useExhaustiveDependencies: tick forces a reload on demand
  useEffect(() => {
    if (paused) return
    let stopped = false
    fetch(url)
      .then(async (response) => {
        const data = await response.json()
        if (stopped) return
        if (!response.ok) throw new Error(data.error ?? 'Could not load runs.')
        setError('')
        setRuns(data.runs)
      })
      .catch((err) => {
        if (!stopped) setError(err instanceof Error ? err.message : 'Could not load runs.')
      })
    return () => {
      stopped = true
    }
  }, [url, paused, tick])

  // Re-arms after every tick, so a failed poll does not end polling.
  // biome-ignore lint/correctness/useExhaustiveDependencies: tick re-arms the timer
  useEffect(() => {
    if (paused || !active) return
    const timer = setTimeout(refresh, intervalMs)
    return () => clearTimeout(timer)
  }, [paused, active, intervalMs, refresh, tick])

  return { runs, setRuns, error, refresh }
}
