import { defineConfig, env } from 'prisma/config'

// Prisma 7 no longer auto-loads .env. Node 24 can do it natively, so there is no
// dotenv dependency. Wrapped because the file may be absent in CI.
try {
  process.loadEnvFile('.env')
} catch {
  // no .env on disk — fall through to the ambient environment
}

export default defineConfig({
  schema: './prisma/schema.prisma',
  datasource: {
    // Migrations run over the unpooled endpoint. Neon's pooler cannot hold the
    // advisory locks and long-lived sessions that `prisma migrate` needs.
    url: env('DIRECT_URL'),
  },
  migrations: {
    path: './prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
})
