# ROLLBACK — m10_constraints

Reverse SQL (apply in order):

```sql
DROP INDEX "JobChecklistItem_jobId_idx";
DROP INDEX "QuoteAddon_quoteId_idx";
DROP INDEX "ChecklistTemplateItem_templateId_idx";
DROP INDEX "JobPhoto_uploadedById_idx";
DROP INDEX "JobNote_authorId_idx";
ALTER TABLE "CreditNote" DROP CONSTRAINT "CreditNote_businessId_fkey";
ALTER TABLE "CreditNote" ADD CONSTRAINT "CreditNote_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CreditNote" DROP CONSTRAINT "CreditNote_amount_nonneg_check";
ALTER TABLE "Part" DROP CONSTRAINT "Part_quantity_nonneg_check";
ALTER TABLE "Part" DROP CONSTRAINT "Part_money_nonneg_check";
ALTER TABLE "JobExpense" DROP CONSTRAINT "JobExpense_amount_nonneg_check";
ALTER TABLE "Job" DROP CONSTRAINT "Job_status_check";
ALTER TABLE "Job" DROP CONSTRAINT "Job_price_nonneg_check";
ALTER TABLE "QuoteDeposit" DROP CONSTRAINT "QuoteDeposit_amount_pos_check";
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_status_check";
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_amount_pos_check";
ALTER TABLE "QuoteLineItem" DROP CONSTRAINT "QuoteLineItem_money_nonneg_check";
ALTER TABLE "QuoteLineItem" DROP CONSTRAINT "QuoteLineItem_qty_pos_check";
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_discount_range_check";
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_deposit_lte_total_check";
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_status_check";
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_money_nonneg_check";
ALTER TABLE "InvoiceLineItem" DROP CONSTRAINT "InvoiceLineItem_money_nonneg_check";
ALTER TABLE "InvoiceLineItem" DROP CONSTRAINT "InvoiceLineItem_qty_pos_check";
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_status_check";
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_money_nonneg_check";
ALTER TABLE "CreditNote" DROP CONSTRAINT "CreditNote_businessId_number_key";
ALTER TABLE "Quote" DROP CONSTRAINT "Quote_businessId_number_key";
ALTER TABLE "Invoice" DROP CONSTRAINT "Invoice_businessId_number_key";
ALTER TABLE "Invoice" DROP COLUMN "dueAt";
```

Also redeploy the pre-M10 code (which does not set `status='VOID'` on void
and does not write `Invoice.dueAt`).
