-- M22 (F5): Per-business message template overrides.

CREATE TABLE IF NOT EXISTS "MessageTemplateOverride" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "locale" TEXT NOT NULL,
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT "MessageTemplateOverride_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MessageTemplateOverride_businessId_templateId_locale_key"
  ON "MessageTemplateOverride"("businessId", "templateId", "locale");

CREATE INDEX IF NOT EXISTS "MessageTemplateOverride_businessId_idx"
  ON "MessageTemplateOverride"("businessId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MessageTemplateOverride_businessId_fkey'
  ) THEN
    ALTER TABLE "MessageTemplateOverride"
      ADD CONSTRAINT "MessageTemplateOverride_businessId_fkey"
      FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE;
  END IF;
END $$;
