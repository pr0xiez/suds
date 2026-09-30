import { setTimeout } from 'node:timers/promises'
import { demoEnabled } from '@/lib/demo'
import { processAiRuns } from '@/lib/workers/ai'

if (!demoEnabled()) throw new Error('Demo worker requires an isolated demo database.')
// No notification dispatch: the local demo inbox is the delivery destination.
while (true) {
  try {
    await processAiRuns(3)
  } catch {
    console.error('Demo assistant tick failed; the saved run remains available for review.')
  }
  await setTimeout(2000)
}
