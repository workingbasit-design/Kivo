-- m30: schema drift since m29 (2026-10-21) — generated with:
--   prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma
-- Covers batch 1 (Business.lastNotificationSyncAt, Job.propertyId, CustomerProperty.province, BookingPage.shareRating),
-- slice 5 (Quote.expiresAt), slice 6 (CustomFieldDef.target + (businessId,target,name) unique),
-- slice 7 (Subcontractor + JobSubcontractor), slice 8 (Invoice.recurringJobId/schedulePeriod,
-- RecurringJob invoiceSchedule/invoiceDayOfMonth/lastInvoicePeriod, unitCostCents), and quote templates
-- (QuoteTemplate + QuoteTemplateItem, PropertyFieldValue, JobFieldValue). Additive except Prisma
-- FK/default/index normalization on a fresh DB; production already carries these columns via db push,
-- so this migration only changes fresh migrate-deploy DBs (CI db-tests / e2e seed).

-- DropForeignKey
ALTER TABLE "JobAssignment" DROP CONSTRAINT "JobAssignment_businessId_fkey";

-- DropForeignKey
ALTER TABLE "JobAssignment" DROP CONSTRAINT "JobAssignment_jobId_fkey";

-- DropForeignKey
ALTER TABLE "JobAssignment" DROP CONSTRAINT "JobAssignment_userId_fkey";

-- DropForeignKey
ALTER TABLE "MessageTemplateOverride" DROP CONSTRAINT "MessageTemplateOverride_businessId_fkey";

-- DropForeignKey
ALTER TABLE "PortalEvent" DROP CONSTRAINT "PortalEvent_businessId_fkey";

-- DropForeignKey
ALTER TABLE "PortalEvent" DROP CONSTRAINT "PortalEvent_shareTokenId_fkey";

-- DropForeignKey
ALTER TABLE "QuoteSignature" DROP CONSTRAINT "QuoteSignature_businessId_fkey";

-- DropForeignKey
ALTER TABLE "QuoteSignature" DROP CONSTRAINT "QuoteSignature_quoteId_fkey";

-- DropForeignKey
ALTER TABLE "VisitSignature" DROP CONSTRAINT "VisitSignature_businessId_fkey";

-- DropForeignKey
ALTER TABLE "VisitSignature" DROP CONSTRAINT "VisitSignature_jobId_fkey";

-- DropIndex
DROP INDEX "CustomFieldDef_businessId_name_key";

-- AlterTable
ALTER TABLE "BookableService" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BookingPage" ADD COLUMN     "shareRating" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "BookingRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Business" ADD COLUMN     "lastNotificationSyncAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "CustomFieldDef" ADD COLUMN     "target" TEXT NOT NULL DEFAULT 'CUSTOMER';

-- AlterTable
ALTER TABLE "CustomerProperty" ADD COLUMN     "province" TEXT;

-- AlterTable
ALTER TABLE "ErrorLog" ALTER COLUMN "lastSeen" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "recurringJobId" TEXT,
ADD COLUMN     "schedulePeriod" TEXT;

-- AlterTable
ALTER TABLE "InvoiceLineItem" ADD COLUMN     "unitCostCents" BIGINT;

-- AlterTable
ALTER TABLE "Job" ADD COLUMN     "propertyId" TEXT,
ALTER COLUMN "skippedAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MessageTemplateOverride" ALTER COLUMN "updatedAt" DROP DEFAULT,
ALTER COLUMN "updatedAt" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "createdAt" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Quote" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "QuoteLineItem" ADD COLUMN     "unitCostCents" BIGINT;

-- AlterTable
ALTER TABLE "RecurringJob" ADD COLUMN     "invoiceDayOfMonth" INTEGER,
ADD COLUMN     "invoiceSchedule" TEXT NOT NULL DEFAULT 'NONE',
ADD COLUMN     "lastInvoicePeriod" TEXT;

-- DropTable
DROP TABLE "_m15_hash_completed";

-- CreateTable
CREATE TABLE "Subcontractor" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "defaultRateCents" BIGINT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subcontractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobSubcontractor" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "hours" DOUBLE PRECISION,
    "amountCents" BIGINT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobSubcontractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyFieldValue" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PropertyFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobFieldValue" (
    "id" TEXT NOT NULL,
    "fieldId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobFieldValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTemplate" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteTemplateItem" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "unitPriceCents" BIGINT NOT NULL,
    "unitCostCents" BIGINT,
    "position" INTEGER NOT NULL,

    CONSTRAINT "QuoteTemplateItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Subcontractor_businessId_idx" ON "Subcontractor"("businessId");

-- CreateIndex
CREATE INDEX "JobSubcontractor_jobId_idx" ON "JobSubcontractor"("jobId");

-- CreateIndex
CREATE INDEX "JobSubcontractor_subcontractorId_idx" ON "JobSubcontractor"("subcontractorId");

-- CreateIndex
CREATE UNIQUE INDEX "JobSubcontractor_jobId_subcontractorId_key" ON "JobSubcontractor"("jobId", "subcontractorId");

-- CreateIndex
CREATE INDEX "PropertyFieldValue_propertyId_idx" ON "PropertyFieldValue"("propertyId");

-- CreateIndex
CREATE UNIQUE INDEX "PropertyFieldValue_fieldId_propertyId_key" ON "PropertyFieldValue"("fieldId", "propertyId");

-- CreateIndex
CREATE INDEX "JobFieldValue_jobId_idx" ON "JobFieldValue"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "JobFieldValue_fieldId_jobId_key" ON "JobFieldValue"("fieldId", "jobId");

-- CreateIndex
CREATE INDEX "QuoteTemplate_businessId_idx" ON "QuoteTemplate"("businessId");

-- CreateIndex
CREATE INDEX "QuoteTemplateItem_templateId_idx" ON "QuoteTemplateItem"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomFieldDef_businessId_target_name_key" ON "CustomFieldDef"("businessId", "target", "name");

-- CreateIndex
CREATE INDEX "Job_propertyId_idx" ON "Job"("propertyId");

-- CreateIndex
CREATE INDEX "VisitSignature_businessId_idx" ON "VisitSignature"("businessId");

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "CustomerProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteSignature" ADD CONSTRAINT "QuoteSignature_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteSignature" ADD CONSTRAINT "QuoteSignature_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalEvent" ADD CONSTRAINT "PortalEvent_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalEvent" ADD CONSTRAINT "PortalEvent_shareTokenId_fkey" FOREIGN KEY ("shareTokenId") REFERENCES "ShareToken"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobAssignment" ADD CONSTRAINT "JobAssignment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitSignature" ADD CONSTRAINT "VisitSignature_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitSignature" ADD CONSTRAINT "VisitSignature_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageTemplateOverride" ADD CONSTRAINT "MessageTemplateOverride_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subcontractor" ADD CONSTRAINT "Subcontractor_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSubcontractor" ADD CONSTRAINT "JobSubcontractor_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobSubcontractor" ADD CONSTRAINT "JobSubcontractor_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyFieldValue" ADD CONSTRAINT "PropertyFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomFieldDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyFieldValue" ADD CONSTRAINT "PropertyFieldValue_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "CustomerProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobFieldValue" ADD CONSTRAINT "JobFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "CustomFieldDef"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobFieldValue" ADD CONSTRAINT "JobFieldValue_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplate" ADD CONSTRAINT "QuoteTemplate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteTemplateItem" ADD CONSTRAINT "QuoteTemplateItem_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "QuoteTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "JobAssignment_job_user_unique" RENAME TO "JobAssignment_jobId_userId_key";

-- RenameIndex
ALTER INDEX "JobAssignment_userId_idx" RENAME TO "JobAssignment_userId_businessId_idx";

-- RenameIndex
ALTER INDEX "VisitSignature_job_idx" RENAME TO "VisitSignature_jobId_idx";

