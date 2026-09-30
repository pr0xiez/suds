import { setTimeout } from 'node:timers/promises'
import { prisma } from '@/lib/db/client'
import { runBackgroundWork } from '@/lib/workers'

let stopped = false
process.on('SIGTERM', () => {
  stopped = true
})
process.on('SIGINT', () => {
  stopped = true
})
async function main() {
  while (!stopped) {
    try {
      await runBackgroundWork()
    } catch {
      console.error(JSON.stringify({ event: 'worker_tick_failed', time: new Date().toISOString() }))
    }
    if (!stopped) await setTimeout(30_000)
  }
  await prisma.$disconnect()
}
main().catch(async () => {
  await prisma.$disconnect()
  process.exitCode = 1
})
