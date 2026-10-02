# 0002 — Payments as the money source of truth (settleJobPaid)

Date: 2026-10-01

## Context

Earnings numbers disagreed: "Collected" and monthly revenue (built from `Payment` records) showed $0.00 while top-customers / avg-job-value / revenue-by-service (built from job prices with done statuses) showed the job's price. Root cause: marking a job PAID only flipped its status — no payment was ever recorded, so the two families of metrics diverged for every cash job without an invoice.

## Decision

**Payment records are the single source of truth for money.** `settleJobPaid(businessId, jobId)` runs in the same transaction as the PAID status update (`updateJobStatus`, `updateJobSchedule`):
- each of the job's open invoices gets a COMPLETED payment for its outstanding balance (provider `OTHER` = pro marked it paid without specifying a method);
- a job with no invoice and a positive price gets a paid invoice (auto-numbered `INV-xxxx`, one line item) plus the matching COMPLETED payment;
- a zero-price job with no invoice just flips status — nothing to record.

Shared `calcTax` remains the single tax engine (preview == stored); `recordPayment` stays transactional (read-check-write atomic, no double-records).

## Alternatives considered

- **Make earnings metrics job-based instead**: rejected — "Payments received" with no payment records is dishonest, and partial payments would break the math.
- **Ask the user for a payment method in a dialog on every "Mark paid"**: better UX in theory, but adds friction to the most common tap; `OTHER` is honest about "method unspecified" and the invoice payment form lets them correct it later.

## Consequences

- Positive: every earnings number agrees by construction; no silent divergence possible.
- Negative: marking paid now creates invoice/payment rows the user didn't explicitly type (labelled `OTHER`, with an auto-note); invoice numbering advances. Existing PAID jobs from before this change still need manual payment recording (one-off, owner-confirmed).
- Known imperfection: money stored as `Float` + `round2`, not integer minor units — a future migration.
