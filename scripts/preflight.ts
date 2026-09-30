import { launchReadiness } from '@/lib/readiness'

try {
  process.loadEnvFile('.env')
} catch {
  /* deployed environments supply variables */
}
const checks = launchReadiness()
for (const check of checks) console.log(`${check.ready ? 'READY' : 'MISSING'} ${check.name}`)
if (checks.some((check) => !check.ready)) process.exitCode = 1
