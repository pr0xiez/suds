import { spawn } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { access, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import pg from 'pg'

if (process.env.NODE_ENV === 'production') throw new Error('Demo setup is development-only.')
try {
  await access('.env.demo.local')
  console.log('Demo already prepared. Run npm run demo to open it; no data was changed.')
  process.exit(0)
} catch {
  // A fresh, random schema is the only target this command ever seeds.
}
process.loadEnvFile('.env')
const schema = `suds_demo_${randomBytes(6).toString('hex')}`
const source = new URL(process.env.DIRECT_URL)
source.searchParams.delete('schema')
const client = new pg.Client({ connectionString: source.href })
await client.connect()
try {
  await client.query(`CREATE SCHEMA "${schema}"`)
} finally {
  await client.end()
}
source.searchParams.set('schema', schema)
const config = {
  DATABASE_URL: source.href,
  DIRECT_URL: source.href,
  PUBLIC_APP_URL: 'http://localhost:4184',
  SUDS_DEMO_MODE: '1',
  STORAGE_DRIVER: 'local',
  SIGNUP_CODE: '',
  OPENAI_API_KEY: '',
  MARKETING_MODEL: '',
  SUBMAGIC_API_KEY: '',
  SHOTSTACK_API_KEY: '',
  S3_ENDPOINT: '',
  S3_BUCKET: '',
  S3_ACCESS_KEY_ID: '',
  S3_SECRET_ACCESS_KEY: '',
  EMAIL_PROVIDER_TOKEN: '',
  EMAIL_FROM: '',
  CRON_SECRET: '',
}
const env = { ...process.env, ...config, NODE_ENV: 'development' }
function run(args, extra = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, { stdio: 'inherit', env: { ...env, ...extra } })
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`Demo preparation exited ${code}`)),
    )
  })
}
try {
  // Prisma records migrations only in the new schema; the existing app schema is untouched.
  await run(['node_modules/prisma/build/index.js', 'migrate', 'deploy'])
  await run(['--import', 'tsx', 'prisma/seed.ts'], {
    ALLOW_DESTRUCTIVE_DEMO_SEED: 'yes',
    SEED_OWNER_PASSWORD: 'SudsDemo2026!',
  })
  await run(['--import', 'tsx', 'scripts/seed-demo.ts'])
  await writeFile(
    '.env.demo.local',
    `${Object.entries(config)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join('\n')}\n`,
    { mode: 0o600 },
  )
} catch (error) {
  // Roll back only the random schema created by this invocation and its generated local photos.
  const cleanup = new pg.Client({ connectionString: source.href })
  await cleanup.connect()
  try {
    const table = await cleanup.query('SELECT to_regclass($1) AS present', [`${schema}."Photo"`])
    const photos = table.rows[0]?.present
      ? (await cleanup.query(`SELECT "filename" FROM "${schema}"."Photo"`)).rows
      : []
    await cleanup.query(`DROP SCHEMA "${schema}" CASCADE`)
    for (const photo of photos)
      if (/^business\/suds-legacy\/media\/[a-f0-9]+\.(png|jpg|webp|gif)$/.test(photo.filename))
        await rm(resolve('data/uploads', photo.filename), { force: true })
  } finally {
    await cleanup.end()
  }
  throw error
}
console.log(
  'Demo prepared in its own disposable schema. Run npm run demo; open http://localhost:4184/demo.',
)
