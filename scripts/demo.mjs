import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { parseEnv } from 'node:util'

const config = parseEnv(await readFile('.env.demo.local', 'utf8'))
const schema = new URL(config.DATABASE_URL).searchParams.get('schema')
if (
  process.env.NODE_ENV === 'production' ||
  config.SUDS_DEMO_MODE !== '1' ||
  !/^suds_demo_[a-f0-9]{12}$/.test(schema ?? '')
)
  throw new Error('Refusing to start a demo against a non-demo database.')
const env = { ...process.env, ...config, NODE_ENV: 'development' }
const children = [
  spawn(
    process.execPath,
    ['node_modules/next/dist/bin/next', 'dev', '--webpack', '--port', '4184'],
    { env, stdio: 'inherit' },
  ),
  spawn(process.execPath, ['--import', 'tsx', 'scripts/demo-worker.ts'], { env, stdio: 'inherit' }),
]
let stopping = false
function stop(code = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill('SIGTERM')
  process.exitCode = code
}
for (const child of children) {
  child.on('error', () => stop(1))
  child.on('exit', (code) => stop(code ?? 0))
}
process.on('SIGINT', () => stop())
process.on('SIGTERM', () => stop())
console.log('Full Suds demo: http://localhost:4184/demo · simulated assistant, no outbound email')
