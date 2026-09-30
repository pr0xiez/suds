import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '@/lib/generated/prisma/client'

// Prisma 7 with a driver adapter: the connection string lives on the adapter, not
// on the client, and not in schema.prisma. See prisma.config.ts for the CLI side.
function createClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
  }

  const schema = new URL(connectionString).searchParams.get('schema') ?? 'public'
  if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema)) {
    throw new Error('DATABASE_URL contains an invalid schema name.')
  }
  // Neon pooled connections reject startup search_path. Default public needs no
  // override; isolated schemas use an unpooled URL and explicit raw-SQL search path.
  const adapter = new PrismaPg(
    { connectionString, ...(schema !== 'public' ? { options: `-c search_path=${schema}` } : {}) },
    { schema },
  )

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })
}

// Next dev hot-reloads modules on every edit; without the global cache each reload
// opens a new pool and Neon starts refusing connections.
const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createClient>
}

export const prisma = globalForPrisma.prisma ?? createClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export type Db = typeof prisma
