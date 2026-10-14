# DATA_MAP.md — Where personal data lives

Every row: data kind → storage → processor → region → retention.
Canada-only product; cross-border transfers below are disclosed honestly.

## Primary store

| Data kind | Storage | Processor | Region | Retention |
|---|---|---|---|---|
| Business profile, memberships, jobs, customers, quotes, invoices, payments, messages, notes, tax lines | Postgres | Prisma Postgres (via Vercel) | **US-East** (current hosting) | See `DATA_RETENTION.md` |
| Attachments, receipt photos, job photos | Object storage | Vercel Blob | US (verify bucket region in dashboard) | Life of account + 30d |

> Region gap: Prisma Postgres / Vercel currently host in US-East. Prefer a
> Canadian region if/when the provider offers one; until then this transfer
> is disclosed in the privacy notice.

## Processors (sub-processors)

| Data kind | Processor | Region | Retention | Notes |
|---|---|---|---|---|
| Email (notifications, review requests) | Resend | US | Per Resend policy | No Canadian-region option today — gap disclosed |
| SMS/WhatsApp messages | Meta WhatsApp | US | Per Meta policy | Consent-gated (`messageConsent`, CASL) |
| Copilot AI prompts (may include job/customer context) | Anthropic | US | Per Anthropic policy | No Canadian-region option today — gap disclosed |
| Card payments | Stripe (business's own account) | Per Stripe | Per Stripe / business | Platform never sees card numbers |
| OAuth identity, calendar sync | Google | US | Per Google policy | OAuth tokens in `Session`/token tables |

## Data kinds by table (selection)

| Kind | Tables |
|---|---|
| Identity (name, email, phone, password hash) | `User`, `CustomerUser`, `Membership` |
| Contact details (address, phone, email) | `Customer`, `CustomerProperty` |
| Financial (amounts, tax numbers) | `Invoice`, `InvoiceLineItem`, `InvoiceTaxLine`, `Payment`, `QuoteDeposit`, `CreditNote` |
| Communications | `MessageLog`, `ConsentLog`, `ReviewRequest`, `Notification` |
| Operational notes/photos | `JobNote`, `JobPhoto`, `ChecklistTemplateItem` |
| Security/audit | `AuditEvent`, `PiaAuditLog`, `Session`, `CustomerSession`, `ConfidentialityIncident` |
| Platform directory | `Business` (public listing fields), `DirectoryRequest`, `Review` |

## Gaps / honest callouts

1. No Canadian-region option for Resend or Anthropic today — cross-border US
   processing disclosed; revisit when regions are offered.
2. Vercel Blob bucket region — verify in the dashboard and update this file.
3. `AuditEvent`/`PiaAuditLog` retain PII-adjacent metadata for 6 years by
   design (accountability); deletion requests anonymize the payload fields,
   not the event skeleton.
