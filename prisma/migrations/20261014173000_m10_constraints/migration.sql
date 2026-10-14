-- M10: constraints — CHECKs, UNIQUE(businessId, number), RESTRICT, FK indexes,
-- Invoice.dueAt.
--
-- Dedupe pass (2026-10-14, scratch DB): 0 duplicate (businessId, number) on
-- Invoice/Quote/CreditNote, 0 NULL numbers. Per the plan, any duplicates found
-- in staging data are listed and renumbered with owner confirmation BEFORE the
-- UNIQUE constraints are applied; production data is out of scope.
--
-- Existing-data validation (scratch, 2026-10-14): no negative money rows, no
-- statuses outside the CHECK vocabularies. The CHECKs below are also
-- validated by the M10 constraint test (src/lib/__tests__/constraints.test.mts).
--
-- NOTE: CHECKs/triggers added via raw SQL are invisible to
-- `prisma migrate diff` (verified: M5's trigger + earlier CHECKs don't show),
-- so the zero-drift check still holds.

-- ------------------------------------------------------------------
-- 1. Invoice.dueAt (nullable; backfilled from date + 30 days for sent
--    invoices, null for drafts). App code sets it on issue/send (net-30).
-- ------------------------------------------------------------------
ALTER TABLE "Invoice" ADD COLUMN "dueAt" TIMESTAMP(3);
UPDATE "Invoice" SET "dueAt" = "date" + INTERVAL '30 days' WHERE "status" <> 'DRAFT';

-- ------------------------------------------------------------------
-- 2. UNIQUE (businessId, number) on Invoice, Quote, CreditNote.
--    (Names match Prisma's default for @@unique([businessId, number]).)
-- ------------------------------------------------------------------
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_businessId_number_key" UNIQUE ("businessId", "number");
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_businessId_number_key" UNIQUE ("businessId", "number");
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_businessId_number_key" UNIQUE ("businessId", "number");

-- ------------------------------------------------------------------
-- 3. CHECK constraints.
--    (Postgres CHECK passes on TRUE or UNKNOWN/NULL; violated only on FALSE,
--    so nullable columns need no extra NULL guards.)
-- ------------------------------------------------------------------

-- Invoice: money >= 0, status vocabulary (incl. VOID — M10 sets status='VOID'
-- on void as the single source of truth; voidedAt/voidReason stay as audit).
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_money_nonneg_check"
  CHECK ("subtotalCents" >= 0 AND "taxAmountCents" >= 0 AND "totalCents" >= 0);
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_status_check"
  CHECK ("status" IN ('DRAFT','UNPAID','PARTIALLY PAID','PAID','VOID'));

-- InvoiceLineItem: qty > 0, money >= 0.
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_qty_pos_check"
  CHECK ("qty" > 0);
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_money_nonneg_check"
  CHECK ("unitPriceCents" >= 0);

-- Quote: money >= 0, status vocabulary, deposit <= total, discount 0-100 for PERCENT.
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_money_nonneg_check"
  CHECK ("totalCents" >= 0
         AND ("depositAmountCents" IS NULL OR "depositAmountCents" >= 0)
         AND ("discountValueCents" IS NULL OR "discountValueCents" >= 0));
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_status_check"
  CHECK ("status" IN ('DRAFT','SENT','APPROVED','DECLINED'));
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_deposit_lte_total_check"
  CHECK ("depositAmountCents" IS NULL OR "depositAmountCents" <= "totalCents");
ALTER TABLE "Quote" ADD CONSTRAINT "Quote_discount_range_check"
  CHECK ("discountType" IS DISTINCT FROM 'PERCENT'
         OR ("discountValue" >= 0 AND "discountValue" <= 100));

-- QuoteLineItem: qty > 0, money >= 0.
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_qty_pos_check"
  CHECK ("qty" > 0);
ALTER TABLE "QuoteLineItem" ADD CONSTRAINT "QuoteLineItem_money_nonneg_check"
  CHECK ("unitPriceCents" >= 0);

-- Payment: amount > 0, status vocabulary (incl. VOID).
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_pos_check"
  CHECK ("amountCents" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_status_check"
  CHECK ("status" IN ('PENDING','COMPLETED','FAILED','VOID'));

-- QuoteDeposit: amount > 0.
ALTER TABLE "QuoteDeposit" ADD CONSTRAINT "QuoteDeposit_amount_pos_check"
  CHECK ("amountCents" > 0);

-- Job: price >= 0, status vocabulary.
ALTER TABLE "Job" ADD CONSTRAINT "Job_price_nonneg_check"
  CHECK ("priceCents" IS NULL OR "priceCents" >= 0);
ALTER TABLE "Job" ADD CONSTRAINT "Job_status_check"
  CHECK ("status" IN ('NEW','SCHEDULED','IN PROGRESS','COMPLETED','PAID','CANCELLED'));

-- JobExpense ("Expense" in the plan): amount >= 0.
ALTER TABLE "JobExpense" ADD CONSTRAINT "JobExpense_amount_nonneg_check"
  CHECK ("amountCents" >= 0);

-- Part: unitCost >= 0, quantity >= 0 (stock can be 0, not negative).
ALTER TABLE "Part" ADD CONSTRAINT "Part_money_nonneg_check"
  CHECK ("unitCostCents" IS NULL OR "unitCostCents" >= 0);
ALTER TABLE "Part" ADD CONSTRAINT "Part_quantity_nonneg_check"
  CHECK ("quantity" >= 0);

-- CreditNote: amount >= 0 (immutable once created — no status column).
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_amount_nonneg_check"
  CHECK ("amountCents" >= 0);

-- ------------------------------------------------------------------
-- 4. ON DELETE RESTRICT: CreditNote.business.
--    (The other 7 on the A4 list are already Restrict in the schema.)
-- ------------------------------------------------------------------
ALTER TABLE "CreditNote" DROP CONSTRAINT "CreditNote_businessId_fkey";
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ------------------------------------------------------------------
-- 5. FK indexes (missing per the A4 audit; names match Prisma defaults).
-- ------------------------------------------------------------------
CREATE INDEX "JobNote_authorId_idx" ON "JobNote"("authorId");
CREATE INDEX "JobPhoto_uploadedById_idx" ON "JobPhoto"("uploadedById");
CREATE INDEX "ChecklistTemplateItem_templateId_idx" ON "ChecklistTemplateItem"("templateId");
CREATE INDEX "QuoteAddon_quoteId_idx" ON "QuoteAddon"("quoteId");
CREATE INDEX "JobChecklistItem_jobId_idx" ON "JobChecklistItem"("jobId");
