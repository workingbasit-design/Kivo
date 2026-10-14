-- M6: IdempotencyKey + WebhookEvent tables.
--
-- NOTE: this migration was written by hand (not `prisma migrate dev
-- --create-only`) because `migrate dev` refuses to run in this
-- non-interactive sandbox (it hangs on a prompt). The DDL follows Prisma's
-- conventions exactly; zero drift vs schema.prisma was verified with
-- `prisma migrate diff --from-url ... --to-schema-datamodel`.

-- CreateTable
CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "key" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "responseJson" TEXT,
    "statusCode" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "businessId" TEXT,
    "type" TEXT NOT NULL,
    "payloadJson" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "IdempotencyKey_businessId_endpoint_key_key" ON "IdempotencyKey"("businessId", "endpoint", "key");

-- CreateIndex
CREATE INDEX "WebhookEvent_businessId_createdAt_idx" ON "WebhookEvent"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookEvent_provider_providerEventId_key" ON "WebhookEvent"("provider", "providerEventId");

-- AddForeignKey
ALTER TABLE "IdempotencyKey" ADD CONSTRAINT "IdempotencyKey_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- M6: CHECK constraint for the provider vocabulary.
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_provider_check" CHECK ("provider" IN ('STRIPE', 'QUICKBOOKS', 'RESEND', 'META'));

-- M6: partial unique index for null-business idempotency rows. Postgres
-- treats NULLs as distinct in the regular unique index, so without this
-- two null-business rows could share (endpoint, key).
CREATE UNIQUE INDEX "IdempotencyKey_null_biz_endpoint_key" ON "IdempotencyKey"("endpoint", "key") WHERE "businessId" IS NULL;

-- M6 backfill: StripeEvent -> WebhookEvent (provider=STRIPE). StripeEvent
-- has no payload column, so payloadJson gets '{}'. Idempotent via
-- ON CONFLICT. StripeEvent itself is kept (read-only, deprecated).
INSERT INTO "WebhookEvent" ("id", "provider", "providerEventId", "businessId", "type", "payloadJson", "processedAt", "createdAt")
SELECT gen_random_uuid()::text, 'STRIPE', "stripeEventId", "businessId", "type", '{}', "processedAt", "createdAt"
FROM "StripeEvent"
ON CONFLICT ("provider", "providerEventId") DO NOTHING;
