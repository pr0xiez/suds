-- Existing rows are assigned to their original business before constraints are installed.
BEGIN;
-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('DRAFT', 'PUBLISHED');

-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('INSTANT', 'REQUEST');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'DECLINED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AccountTokenPurpose" AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD', 'CUSTOMER_LINK', 'MEMBERSHIP_INVITE');

-- DropForeignKey
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_customerId_fkey";

-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_vehicleId_fkey";

-- DropForeignKey
ALTER TABLE "Photo" DROP CONSTRAINT "Photo_jobId_fkey";

-- DropIndex
DROP INDEX "Job_invoiceNumber_key";

-- DropIndex
DROP INDEX "Job_scheduledAt_idx";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailVerifiedAt" TIMESTAMP(3);

-- AlterTable
CREATE SEQUENCE settings_id_seq;
ALTER TABLE "Settings" ADD COLUMN     "bookingMode" "BookingMode" NOT NULL DEFAULT 'INSTANT',
ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'suds-legacy',
ADD COLUMN     "cancellationHours" INTEGER NOT NULL DEFAULT 24,
ADD COLUMN     "horizonDays" INTEGER NOT NULL DEFAULT 60,
ADD COLUMN     "leadTimeMin" INTEGER NOT NULL DEFAULT 120,
ADD COLUMN     "setupComplete" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "travelBufferMin" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "workingHours" JSONB NOT NULL DEFAULT '[{"day":0,"start":"09:00","end":"17:00"},{"day":1,"start":"09:00","end":"17:00"},{"day":2,"start":"09:00","end":"17:00"},{"day":3,"start":"09:00","end":"17:00"},{"day":4,"start":"09:00","end":"17:00"}]',
ALTER COLUMN "id" SET DEFAULT nextval('settings_id_seq');
ALTER SEQUENCE settings_id_seq OWNED BY "Settings"."id";

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'suds-legacy',
ADD COLUMN     "userId" TEXT;

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'suds-legacy';

-- AlterTable
ALTER TABLE "Service" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'suds-legacy';

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'suds-legacy',
ADD COLUMN     "locationAddress" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "waterPowerNotes" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "approvedForMarketing" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'suds-legacy';

-- AlterTable
ALTER TABLE "SocialPost" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'suds-legacy';

-- AlterTable
ALTER TABLE "CaptionTemplate" ADD COLUMN     "businessId" TEXT NOT NULL DEFAULT 'suds-legacy';

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "BusinessStatus" NOT NULL DEFAULT 'DRAFT',
    "serviceArea" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessMembership" (
    "acceptedAt" TIMESTAMP(3),
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'STAFF',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessMembership_pkey" PRIMARY KEY ("businessId","userId")
);

-- CreateTable
CREATE TABLE "AccountToken" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "purpose" "AccountTokenPurpose" NOT NULL,
    "userId" TEXT NOT NULL,
    "businessId" TEXT,
    "customerId" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimitBucket" (
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "NotificationOutbox" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "serviceSnapshots" JSONB NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "reservedUntil" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "address" TEXT NOT NULL DEFAULT '',
    "waterPowerNotes" TEXT NOT NULL DEFAULT '',
    "customerNotes" TEXT NOT NULL DEFAULT '',
    "priceCents" INTEGER NOT NULL,
    "jobId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AvailabilityBlock" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "AvailabilityBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MediaUpload" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "approvedForMarketing" BOOLEAN NOT NULL DEFAULT false,
    "jobId" TEXT,
    "photoKind" "PhotoKind",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MediaUpload_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiRun" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'QUEUED',
    "request" JSONB NOT NULL,
    "output" JSONB,
    "provider" TEXT NOT NULL,
    "providerId" TEXT,
    "objectKey" TEXT,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "idempotencyKey" TEXT NOT NULL,

    CONSTRAINT "AiRun_pkey" PRIMARY KEY ("id")
);

-- Preserve all existing identities and business data. Do not auto-link customers by email.
INSERT INTO "Business" ("id", "slug", "name", "updatedAt")
VALUES ('suds-legacy', 'suds-detailing', COALESCE((SELECT "businessName" FROM "Settings" ORDER BY "id" LIMIT 1), 'Suds Auto Detailing'), CURRENT_TIMESTAMP);
INSERT INTO "BusinessMembership" ("businessId", "userId", "role", "active", "acceptedAt")
SELECT 'suds-legacy', "id", "role", "active", CURRENT_TIMESTAMP FROM "User";
UPDATE "User" SET "emailVerifiedAt" = CURRENT_TIMESTAMP;
SELECT setval('settings_id_seq', COALESCE((SELECT MAX("id") FROM "Settings"), 1), EXISTS (SELECT 1 FROM "Settings"));
ALTER TABLE "Settings" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "Customer" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "Vehicle" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "Service" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "Job" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "Photo" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "SocialPost" ALTER COLUMN "businessId" DROP DEFAULT;
ALTER TABLE "CaptionTemplate" ALTER COLUMN "businessId" DROP DEFAULT;

-- CreateIndex
CREATE UNIQUE INDEX "Business_slug_key" ON "Business"("slug");

-- CreateIndex
CREATE INDEX "BusinessMembership_userId_active_idx" ON "BusinessMembership"("userId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "AccountToken_tokenHash_key" ON "AccountToken"("tokenHash");

-- CreateIndex
CREATE INDEX "AccountToken_userId_purpose_expiresAt_idx" ON "AccountToken"("userId", "purpose", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationOutbox_dedupeKey_key" ON "NotificationOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "NotificationOutbox_status_availableAt_idx" ON "NotificationOutbox"("status", "availableAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_jobId_key" ON "Booking"("jobId");

-- CreateIndex
CREATE INDEX "Booking_businessId_status_scheduledAt_idx" ON "Booking"("businessId", "status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_businessId_customerId_idempotencyKey_key" ON "Booking"("businessId", "customerId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "AvailabilityBlock_businessId_startsAt_idx" ON "AvailabilityBlock"("businessId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "MediaUpload_objectKey_key" ON "MediaUpload"("objectKey");

-- CreateIndex
CREATE INDEX "MediaUpload_businessId_status_idx" ON "MediaUpload"("businessId", "status");

-- CreateIndex
CREATE INDEX "AiRun_businessId_status_nextAttemptAt_idx" ON "AiRun"("businessId", "status", "nextAttemptAt");

-- CreateIndex
CREATE INDEX "AiRun_status_nextAttemptAt_idx" ON "AiRun"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "AiRun_businessId_idempotencyKey_key" ON "AiRun"("businessId", "idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "Settings_businessId_key" ON "Settings"("businessId");

-- CreateIndex
CREATE INDEX "Customer_businessId_idx" ON "Customer"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_businessId_userId_key" ON "Customer"("businessId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_businessId_id_key" ON "Customer"("businessId", "id");

-- CreateIndex
CREATE INDEX "Vehicle_businessId_idx" ON "Vehicle"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_businessId_id_key" ON "Vehicle"("businessId", "id");

-- CreateIndex
CREATE INDEX "Service_businessId_idx" ON "Service"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Service_businessId_id_key" ON "Service"("businessId", "id");

-- CreateIndex
CREATE INDEX "Job_businessId_scheduledAt_idx" ON "Job"("businessId", "scheduledAt");

-- CreateIndex
CREATE INDEX "Job_businessId_idx" ON "Job"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Job_businessId_invoiceNumber_key" ON "Job"("businessId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Job_businessId_id_key" ON "Job"("businessId", "id");

-- CreateIndex
CREATE INDEX "Photo_businessId_idx" ON "Photo"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "Photo_businessId_id_key" ON "Photo"("businessId", "id");

-- CreateIndex
CREATE INDEX "SocialPost_businessId_idx" ON "SocialPost"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "SocialPost_businessId_id_key" ON "SocialPost"("businessId", "id");

-- CreateIndex
CREATE INDEX "CaptionTemplate_businessId_idx" ON "CaptionTemplate"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "CaptionTemplate_businessId_id_key" ON "CaptionTemplate"("businessId", "id");

-- AddForeignKey
ALTER TABLE "BusinessMembership" ADD CONSTRAINT "BusinessMembership_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessMembership" ADD CONSTRAINT "BusinessMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountToken" ADD CONSTRAINT "AccountToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationOutbox" ADD CONSTRAINT "NotificationOutbox_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Settings" ADD CONSTRAINT "Settings_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_businessId_customerId_fkey" FOREIGN KEY ("businessId", "customerId") REFERENCES "Customer"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Service" ADD CONSTRAINT "Service_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_businessId_customerId_fkey" FOREIGN KEY ("businessId", "customerId") REFERENCES "Customer"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_businessId_vehicleId_fkey" FOREIGN KEY ("businessId", "vehicleId") REFERENCES "Vehicle"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_businessId_jobId_fkey" FOREIGN KEY ("businessId", "jobId") REFERENCES "Job"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocialPost" ADD CONSTRAINT "SocialPost_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaptionTemplate" ADD CONSTRAINT "CaptionTemplate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_businessId_customerId_fkey" FOREIGN KEY ("businessId", "customerId") REFERENCES "Customer"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_businessId_vehicleId_fkey" FOREIGN KEY ("businessId", "vehicleId") REFERENCES "Vehicle"("businessId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AvailabilityBlock" ADD CONSTRAINT "AvailabilityBlock_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MediaUpload" ADD CONSTRAINT "MediaUpload_businessId_jobId_fkey" FOREIGN KEY ("businessId", "jobId") REFERENCES "Job"("businessId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiRun" ADD CONSTRAINT "AiRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Retain SetNull historical links while forbidding cross-business relationships.
CREATE FUNCTION suds_check_record_business() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a TEXT; b TEXT;
BEGIN
  -- Dispatch by table before resolving NEW fields: each trigger has a different record shape.
  IF TG_TABLE_NAME = 'JobItem' THEN
    IF NEW."serviceId" IS NULL THEN RETURN NEW; END IF;
    SELECT "businessId" INTO a FROM "Job" WHERE "id" = NEW."jobId";
    SELECT "businessId" INTO b FROM "Service" WHERE "id" = NEW."serviceId";
  ELSIF TG_TABLE_NAME = 'SocialPost' THEN
    IF NEW."jobId" IS NULL THEN RETURN NEW; END IF;
    a := NEW."businessId";
    SELECT "businessId" INTO b FROM "Job" WHERE "id" = NEW."jobId";
  ELSIF TG_TABLE_NAME = 'PostPhoto' THEN
    SELECT "businessId" INTO a FROM "SocialPost" WHERE "id" = NEW."postId";
    SELECT "businessId" INTO b FROM "Photo" WHERE "id" = NEW."photoId";
  ELSIF TG_TABLE_NAME = 'Booking' THEN
    IF NEW."jobId" IS NULL THEN RETURN NEW; END IF;
    a := NEW."businessId";
    SELECT "businessId" INTO b FROM "Job" WHERE "id" = NEW."jobId";
  ELSE
    RETURN NEW;
  END IF;
  IF a IS NULL OR b IS NULL OR a <> b THEN
    RAISE EXCEPTION 'Related records must belong to the same business' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "JobItem_business_check" BEFORE INSERT OR UPDATE ON "JobItem" FOR EACH ROW EXECUTE FUNCTION suds_check_record_business();
CREATE TRIGGER "SocialPost_business_check" BEFORE INSERT OR UPDATE ON "SocialPost" FOR EACH ROW EXECUTE FUNCTION suds_check_record_business();
CREATE TRIGGER "PostPhoto_business_check" BEFORE INSERT OR UPDATE ON "PostPhoto" FOR EACH ROW EXECUTE FUNCTION suds_check_record_business();
CREATE TRIGGER "Booking_business_check" BEFORE INSERT OR UPDATE ON "Booking" FOR EACH ROW EXECUTE FUNCTION suds_check_record_business();

COMMIT;
