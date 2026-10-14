-- M7: privacy + audit columns.
--
-- NOTE: hand-written (see M6 note: `migrate dev` hangs non-interactively
-- in this sandbox). Zero drift vs schema.prisma verified with `migrate diff`.

-- createdBy/updatedBy on Job (A4)
ALTER TABLE "Job" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Job" ADD COLUMN "updatedBy" TEXT;

-- createdBy/updatedBy on Invoice (A4)
ALTER TABLE "Invoice" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "updatedBy" TEXT;

-- createdBy/updatedBy on Payment (A4)
ALTER TABLE "Payment" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Payment" ADD COLUMN "updatedBy" TEXT;

-- createdBy/updatedBy on Quote (A4)
ALTER TABLE "Quote" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Quote" ADD COLUMN "updatedBy" TEXT;

-- createdBy/updatedBy on CreditNote (A4)
ALTER TABLE "CreditNote" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "CreditNote" ADD COLUMN "updatedBy" TEXT;

-- createdBy/updatedBy on Customer (A4)
ALTER TABLE "Customer" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Customer" ADD COLUMN "updatedBy" TEXT;

-- createdBy/updatedBy on Lead (A4)
ALTER TABLE "Lead" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Lead" ADD COLUMN "updatedBy" TEXT;

-- createdBy/updatedBy on JobExpense (A4)
ALTER TABLE "JobExpense" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "JobExpense" ADD COLUMN "updatedBy" TEXT;

-- createdBy/updatedBy on TimeEntry (A4)
ALTER TABLE "TimeEntry" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "TimeEntry" ADD COLUMN "updatedBy" TEXT;

-- createdBy/updatedBy on Project (A4)
ALTER TABLE "Project" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "Project" ADD COLUMN "updatedBy" TEXT;

-- createdBy/updatedBy on QuoteDeposit (A4)
ALTER TABLE "QuoteDeposit" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "QuoteDeposit" ADD COLUMN "updatedBy" TEXT;

-- createdBy/updatedBy on MessageLog (A4)
ALTER TABLE "MessageLog" ADD COLUMN "createdBy" TEXT;
ALTER TABLE "MessageLog" ADD COLUMN "updatedBy" TEXT;

-- Customer.archivedBy (archivedAt already existed)
ALTER TABLE "Customer" ADD COLUMN "archivedBy" TEXT;

-- Job.archivedAt/archivedBy
ALTER TABLE "Job" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Job" ADD COLUMN "archivedBy" TEXT;

-- Equipment.archivedAt/archivedBy
ALTER TABLE "Equipment" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Equipment" ADD COLUMN "archivedBy" TEXT;

-- CreateTable
CREATE TABLE "ConfidentialityIncident" (
    "id" TEXT NOT NULL,
    "businessId" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL,
    "summary" TEXT NOT NULL,
    "dataTypes" TEXT NOT NULL,
    "affectedCount" INTEGER,
    "notifiedCommission" BOOLEAN NOT NULL DEFAULT false,
    "notifiedAffected" BOOLEAN NOT NULL DEFAULT false,
    "measuresTaken" TEXT,
    "status" TEXT NOT NULL,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConfidentialityIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConfidentialityIncident_businessId_createdAt_idx" ON "ConfidentialityIncident"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "ConfidentialityIncident_status_idx" ON "ConfidentialityIncident"("status");

-- AddForeignKey
ALTER TABLE "ConfidentialityIncident" ADD CONSTRAINT "ConfidentialityIncident_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- M7: CHECK constraint for the incident-status vocabulary (Quebec Law 25 register).
ALTER TABLE "ConfidentialityIncident" ADD CONSTRAINT "ConfidentialityIncident_status_check" CHECK ("status" IN ('OPEN', 'CONTAINED', 'CLOSED'));
