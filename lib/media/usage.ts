import type { Prisma } from '@/lib/generated/prisma/client'
export const PILOT_STORAGE_BYTES = 2 * 1024 * 1024 * 1024
export class StorageLimitError extends Error {}
/** Count originals once, migrated legacy photos, and saved/reserved render outputs. */
export async function storedBusinessBytes(
  tx: Prisma.TransactionClient,
  businessId: string,
  excludeRunId = '',
) {
  const rows = await tx.$queryRaw<Array<{ bytes: number }>>`SELECT (
    COALESCE((SELECT SUM("sizeBytes") FROM "MediaUpload" WHERE "businessId"=${businessId} AND "status" IN ('PENDING','FINALIZING','READY','DELETING')),0)
    + COALESCE((SELECT SUM(p."bytes") FROM "Photo" p WHERE p."businessId"=${businessId} AND NOT EXISTS (SELECT 1 FROM "MediaUpload" u WHERE u."businessId"=p."businessId" AND u."objectKey"=p."filename")),0)
    + COALESCE((SELECT SUM(CASE WHEN jsonb_typeof("output"->'bytes')='number' THEN ("output"->>'bytes')::bigint ELSE 0 END) FROM "AiRun" WHERE "businessId"=${businessId} AND "id"<>${excludeRunId} AND "kind" IN ('VIDEO','PHOTOS')),0)
  )::double precision AS "bytes"`
  return rows[0]?.bytes ?? 0
}
