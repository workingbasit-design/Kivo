# C2: Interac e-Transfer Matching — Spec

**Status:** Draft — awaiting user OK before build.
**Date:** 2026-10-15
**Tier:** 2 (pick 2 of 3)

## Goal

Each invoice gets a short reference code. The invoice/PDF says: send an
e-Transfer to (business email), put (code) in the message. The business
forwards Interac deposit notification emails to a private inbound address;
the app parses amount/sender/message/date, verifies the sender (Interac's
published addresses + DKIM pass), and suggests a match (code first, then
amount + name). The owner confirms with one tap. **Never marks anything
paid automatically.** Manual "Record e-Transfer" fallback. Tests use fake
fixtures, never real emails.

## Personas & user stories

### Owner
- As an owner, I see "Suggested match: $249.90 from Jane Doe — code Q-1042
  — matches INV-0031" and tap Confirm; the invoice is marked paid.
- As an owner, I can always record an e-Transfer manually.

### Customer
- As a customer, my invoice tells me exactly where to send the e-Transfer
  and what to put in the message.

## Screens (390px ASCII)

### Invoice shows e-Transfer instructions

```
+--------------------------------------+
|  < Invoice INV-0031                   |
|  Balance owing: $249.90              |
|                                      |
|  Pay by e-Transfer                    |
|  Send to: pay@mapleleaf.ca           |
|  Amount: $249.90                     |
|  Message: EJ-7K2P                    |
|  [ Copy details ]                    |
|                                      |
|  Your payment is matched              |
|  automatically — usually within       |
|  an hour.                            |
+--------------------------------------+
```

### Owner: match review

```
+--------------------------------------+
|  < e-Transfer matching                |
|                                      |
|  ● $249.90 · EJ-7K2P · Matched      |
|    INV-0031 · 10:42            [ > ] |
|  ● $189.00 · (no code) · Review     |
|    Possible: INV-0028          [ > ] |
|  ○ $60.00 · EJ-9Q1A · Unmatched    |
|    2 days old                  [ > ] |
+--------------------------------------+
```

## Flow

1. Invoice issued → reference code (e.g., `EJ-7K2P`) generated, shown on
   invoice + PDF (F2).
2. Business sets up email forwarding of Interac notifications to
   `etransfer-<businessid>@inbound.everyjob.ca` (private per business).
3. Inbound email → verify sender domain against Interac's published
   notification addresses + require DKIM pass → parse amount, sender name,
   message, date.
4. Match: reference code in message → exact; else amount + sender name →
   suggested with confidence.
5. Owner confirms → `Payment` row (provider INTERAC) → invoice balance
   updates. Rejected suggestions are logged (tuning).

## Data model (migration M23)

- `Invoice`: add `etransferCode String? @unique`.
- `EtransferInbound`: id, businessId, fromAddress, senderName?,
  amountCents?, message?, receivedAt, dkimPass Boolean, rawJson Json,
  status (PENDING/MATCHED/REJECTED/IGNORED).
- `EtransferMatch`: id, inboundId, invoiceId, businessId, confidence,
  status (SUGGESTED/CONFIRMED/REJECTED), confirmedById?.

## Security

- Inbound address is unguessable per business (`etransfer-<random>`).
- Sender verification: envelope-from domain allowlist (Interac's published
  domains, re-verified at build) AND DKIM pass required. Fail → IGNORED +
  logged.
- Never auto-marks paid. Owner confirms every match.
- Rate limit inbound processing; cap email size.

## Permissions

| Action | Owner/Admin | Others |
|---|---|---|
| Confirm/reject match | ✅ | ❌ |
| Manual record | ✅ | ❌ |

## Tenant isolation

Inbound address maps to exactly one business. Matches never cross
businesses. Negative test: email to Business A's address cannot match
Business B's invoice.

## Edge cases

1. No code in message + amount matches 2 invoices → show both, owner picks.
2. Amount off by cents (fees) → fuzzy match flagged "amount differs".
3. Duplicate notification email → idempotent (message-id dedupe).
4. Forwarding misconfigured → owner sees "no emails received in 7 days" hint.
5. Test fixtures only — no real Interac emails in tests.

## Out of scope

- Auto-accepting matches (explicitly never).
- Other banks' formats (Interac notifications only).

## Acceptance tests

| ID | Test |
|---|---|
| C2-001 | Unit: reference code generation (unique, readable). |
| C2-002 | Unit: email parsing (fixtures) — amount/sender/message/date. |
| C2-003 | Unit: sender verification (spoofed domain → rejected; DKIM fail → rejected). |
| C2-004 | Unit: matching (code exact, amount+name fuzzy). |
| C2-005 | DB: cross-business isolation. |
| C2-006 | E2E (owner): suggested match → confirm → invoice paid. |
| C2-007 | E2E: spoofed email → ignored, logged. |
| C2-008 | E2E: manual record fallback. |
| C2-009 | A11y + fr-CA. |
| C2-010 | Auth matrix additions. |

## Build checklist

- [ ] Migration M23; RLS staged.
- [ ] Interac sender domains re-verified (link in report).
- [ ] Feature flag `etransferMatching`.
- [ ] en-CA + fr-CA; parity green.
- [ ] Tests C2-001…010 green; CI green; report; then stop.
