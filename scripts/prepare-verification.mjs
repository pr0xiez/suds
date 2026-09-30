import { randomBytes } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import pg from 'pg'

// Only creates a new schema. Never applies migrations to the existing app schema.
process.loadEnvFile('.env')
const schema = `suds_verify_${randomBytes(6).toString('hex')}`
const client = new pg.Client({ connectionString: process.env.DIRECT_URL })
await client.connect()
try {
  await client.query(`CREATE SCHEMA "${schema}"`)
  await client.query(`SET search_path TO "${schema}"`)
  const init = await readFile('prisma/migrations/20260820004120_init/migration.sql', 'utf8')
  await client.query(init)
  // Representative old records prove the migration preserves existing relationships.
  await client.query(`
    INSERT INTO "Settings" ("id","businessName") VALUES (1,'Migration fixture');
    INSERT INTO "User" ("id","email","name","passwordHash","role") VALUES ('migrationowner','migration-owner@example.test','Migration owner','unusable-fixture-hash','OWNER');
    INSERT INTO "Customer" ("id","name") VALUES ('migrationcustomer','Migration customer');
    INSERT INTO "Vehicle" ("id","customerId","make","model") VALUES ('migrationvehicle','migrationcustomer','Toyota','Camry');
    INSERT INTO "Service" ("id","name","priceCents","durationMin") VALUES ('migrationservice','Migration service',10000,60);
    INSERT INTO "Job" ("id","customerId","vehicleId","scheduledAt","durationMin","invoiceNumber") VALUES ('migrationjob','migrationcustomer','migrationvehicle',CURRENT_TIMESTAMP,60,1001);
    INSERT INTO "JobItem" ("id","jobId","serviceId","name","priceCents","durationMin") VALUES ('migrationitem','migrationjob','migrationservice','Migration service',10000,60);
    INSERT INTO "Photo" ("id","jobId","filename","contentType","bytes") VALUES ('migrationphoto','migrationjob','migrationphoto.png','image/png',64);
    INSERT INTO "SocialPost" ("id","caption","platforms","jobId") VALUES ('migrationpost','Migration post',ARRAY['INSTAGRAM']::"Platform"[],'migrationjob');
    INSERT INTO "PostPhoto" ("postId","photoId","sort") VALUES ('migrationpost','migrationphoto',0);
  `)
  const migration = await readFile(
    'prisma/migrations/20260930000000_business_launch/migration.sql',
    'utf8',
  )
  await client.query(migration)
  const { rows } =
    await client.query(`SELECT j."invoiceNumber", c."name", p."filename", u."emailVerifiedAt" IS NOT NULL AS verified
    FROM "Job" j JOIN "Customer" c ON c."id"=j."customerId" JOIN "Photo" p ON p."jobId"=j."id"
    JOIN "BusinessMembership" m ON m."businessId"=j."businessId" JOIN "User" u ON u."id"=m."userId"
    WHERE j."id"='migrationjob' AND j."businessId"='suds-legacy'`)
  if (rows.length !== 1 || rows[0].invoiceNumber !== 1001 || !rows[0].verified)
    throw new Error('Migration preservation failed')
  const env = {}
  for (const key of ['DATABASE_URL', 'DIRECT_URL']) {
    // Neon pooled connections reject startup search_path; verification uses direct.
    const url = new URL(process.env.DIRECT_URL)
    url.searchParams.set('schema', schema)
    env[key] = url.href
  }
  await writeFile(
    '.env.verification.local',
    `${Object.entries(env)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join('\n')}\n`,
    { mode: 0o600 },
  )
  console.log(`PASS: migration preserved legacy records in isolated schema ${schema}`)
  console.log('Verification environment saved locally; no existing application rows changed.')
} finally {
  await client.end()
}
