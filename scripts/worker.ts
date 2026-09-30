import { prisma } from '@/lib/db/client'
import { runBackgroundWork } from '@/lib/workers'

runBackgroundWork().then(
  async (result) => {
    console.log(JSON.stringify(result))
    await prisma.$disconnect()
  },
  async () => {
    console.error('Background work failed. Check operational logs.')
    await prisma.$disconnect()
    process.exitCode = 1
  },
)
