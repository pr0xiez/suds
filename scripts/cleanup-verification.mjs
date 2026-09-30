import pg from 'pg'

process.loadEnvFile('.env.verification.local')
const url = new URL(process.env.DIRECT_URL)
const schema = url.searchParams.get('schema')
if (!/^suds_verify_[a-f0-9]{12}$/.test(schema ?? ''))
  throw new Error('Refusing to clean a non-verification schema.')
const client = new pg.Client({ connectionString: url.href })
await client.connect()
try {
  await client.query(`DROP SCHEMA "${schema}" CASCADE`)
  console.log('Removed isolated verification schema.')
} finally {
  await client.end()
}
