# DATA_RETENTION.md — Retention + deletion procedure

Canada-only. PIPEDA / Quebec Law 25 aligned. Financial records follow CRA
6-year retention.

## Retention rules

| Data | Keep | Why |
|---|---|---|
| Financial documents: Invoice, InvoiceLineItem, InvoiceTaxLine, Payment, QuoteDeposit, CreditNote (+ tax lines) | **6 years** from tax year-end | CRA requirement |
| AuditEvent, PiaAuditLog, ConfidentialityIncident | **6 years** | Accountability / Law 25 register |
| Active business records (jobs, customers, quotes, messages) | Life of the account + 30 days | Service operation |
| WebhookEvent, IdempotencyKey, RateLimit | 90 days | Debugging / replay safety |
| Session, PasswordResetToken | Until expiry + 7 days | Security hygiene |

## Account deletion procedure (business account)

1. **Request + verification.** The requester proves ownership (signed in as a
   membership OWNER, or verified via the account email for consumer accounts).
2. **Owner-only + confirmation.** Deletion is a membership-OWNER-only action,
   requires typing the business name to confirm, and writes an `AuditEvent`.
3. **Within 30 days of the verified request:**
   - Personal data deleted or anonymized: names, emails, phones, addresses,
     messages (`MessageLog`), notes (`JobNote`), photos (`JobPhoto` files +
     rows), notification tokens.
   - Anonymization = replace PII with `deleted-<id>` placeholders, **keep FK
     structure** so financial documents stay referentially intact.
4. **Financial documents are NOT deleted** — kept 6 years with ONLY the fields
   needed for tax/audit (customer name + address + amounts + tax numbers).
   Phone/email/notes are stripped from them.
5. **Consumer (`CustomerUser`) deletion:** profile + messages + saved pros
   deleted; quote requests (`DirectoryRequest`) anonymized — the business keeps
   the service/description for its records, customer name/email replaced with
   placeholders.

## What "deleted" means technically

- Hard `DELETE` for identity/session rows (`User`, `Session`, tokens).
- `archivedAt` soft-delete first (restorable 30-day grace), then hard delete or
  anonymize per the table above.
- Blob attachments (Vercel Blob): delete the object, not just the row.
- Backups: rows persist in backup snapshots until the snapshot ages out
  (documented in `BACKUP_RESTORE.md`); deletion requests are honored in live
  data within 30 days, backups on their retention schedule.

## Quebec Law 25 confidentiality incidents

Any incident touching personal data follows `docs/INCIDENT_RUNBOOK.md` and is
recorded in `ConfidentialityIncident` (the Law 25 register) — register entry
within 72h of discovery.
