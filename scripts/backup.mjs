import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

try {
  process.loadEnvFile('.env')
} catch {
  /* ambient deployment configuration */
}
const url = new URL(process.env.DIRECT_URL ?? '')
if (url.protocol !== 'postgresql:' && url.protocol !== 'postgres:')
  throw new Error('DIRECT_URL must be PostgreSQL.')
const directory = path.resolve('.backups')
await mkdir(directory, { recursive: true, mode: 0o700 })
const filename = path.join(directory, `suds-${new Date().toISOString().replaceAll(':', '-')}.dump`)
// Keep the database password out of process arguments and console output.
const child = spawn('pg_dump', ['--format=custom', '--no-owner', '--no-acl', '--file', filename], {
  stdio: ['ignore', 'ignore', 'inherit'],
  env: {
    ...process.env,
    PGHOST: url.hostname,
    PGPORT: url.port || '5432',
    PGDATABASE: decodeURIComponent(url.pathname.slice(1)),
    PGUSER: decodeURIComponent(url.username),
    PGPASSWORD: decodeURIComponent(url.password),
    PGSSLMODE: url.searchParams.get('sslmode') ?? 'require',
  },
})
child.on('error', () => {
  console.error('Install the PostgreSQL pg_dump client to create backups.')
  process.exitCode = 1
})
child.on('exit', (code) => {
  if (code !== 0) process.exitCode = 1
  else
    console.log(`Backup saved to ${filename}. Store it securely and test restoration on staging.`)
})
