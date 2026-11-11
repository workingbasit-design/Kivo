-- m32 (M2): backfill Business.gstHstRegistered.
--
-- The column existed with @default(false) and its schema comment already
-- promised "invoices show tax lines only when true", but nothing ever read
-- it: invoices and quotes computed tax unconditionally. Invoice and quote
-- creation now honour the flag.
--
-- Because the default is FALSE, shipping that change without a backfill
-- would silently stop every existing business from charging GST/HST - a
-- money-affecting regression for everyone who is legitimately registered.
-- So mark as registered any business that shows evidence of it:
--   (a) it has a GST/HST number on file (the "gstin" column behind
--       Business.taxId; the CRA only issues one to a registrant), or
--   (b) it has already issued an invoice carrying tax, i.e. a non-zero
--       taxAmountCents or any InvoiceTaxLine with a non-zero amount.
--
-- A business with neither keeps false, which is the correct and safe state
-- for a small supplier under the CRA threshold.
--
-- Idempotent: it only ever flips false -> true for businesses matching the
-- evidence, so re-running changes nothing, and it never turns OFF a flag an
-- owner has since set by hand in Settings.
UPDATE "Business" b
SET "gstHstRegistered" = true
WHERE b."gstHstRegistered" = false
  AND (
    (b."gstin" IS NOT NULL AND btrim(b."gstin") <> '')
    OR EXISTS (
      SELECT 1 FROM "Invoice" i
      WHERE i."businessId" = b."id"
        AND i."voidedAt" IS NULL
        AND i."taxAmountCents" > 0
    )
    OR EXISTS (
      SELECT 1 FROM "Invoice" i
      JOIN "InvoiceTaxLine" tl ON tl."invoiceId" = i."id"
      WHERE i."businessId" = b."id"
        AND i."voidedAt" IS NULL
        AND tl."amountCents" > 0
    )
  );
