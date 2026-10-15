# C1: Lower-Fee Canadian Payments — Spec

**Status:** Draft — awaiting user OK before build.
**Date:** 2026-10-15
**Tier:** 2 (pick 1 of 3 — chosen for the money core)

## Goal

Stripe Connect onboarding per business. Cards, Apple Pay, Google Pay, and
Canadian pre-authorized debit (PAD) via Stripe's mandate flow. Deposits,
partial payments, refunds, optional tips, payouts report, fees shown to the
business. On invoices above a business-chosen amount, "Pay by bank (lower
fee)" is shown first. Payment intents created server-side from the stored
balance. Webhooks verified and idempotent. PAD shows "Processing" until
clear; failures and reversals handled. Platform fee configurable (zero at
launch).

## Current state

Stripe test mode is wired (`STRIPE_SECRET_KEY`, webhook secret set);
Connect onboarding is not completed by the user (needs their legal/bank
steps). `/api/pay/*` exists. C1 completes the payment surface.

## Personas & user stories

### Owner
- As an owner, I connect my Stripe account (onboarding), and customers can
  pay by card, Apple Pay, Google Pay, or bank (PAD).
- As an owner, I set "show bank first above $X"; on a $2,000 invoice the
  customer sees "Pay by bank (lower fee)" first.
- As an owner, I see fees per payment and a payouts report.
- As an owner, I refund a payment with a reason; the invoice balance
  updates.

### Customer
- As a customer, I pay the invoice by card or bank; PAD shows "Processing"
  until it clears (I’m told it takes a few days).

## PAD specifics (Stripe)

- Mandate collected at payment time (Stripe's Canadian PAD mandate text,
  shown in en/fr).
- `payment_method_types: ['acss_debit']`; micro-deposits or instant
  verification per Stripe.
- Status PENDING until the webhook confirms; failure/reversal → invoice
  back to unpaid + owner notified (F10).
- **Owner to verify with a professional** PAD disclosure requirements.

## Data model (migration M22)

- `Business`: add `stripeAccountId String?`, `stripeOnboarded Boolean
  @default(false)`, `bankFirstAboveCents BigInt?`, `platformFeeBps Int
  @default(0)`.
- `Payment`: add `method` (CARD/PAD/APPLE_PAY/GOOGLE_PAY), `feeCents`,
  `netCents`, `stripeIntentId @unique`, `failureReason?`.
- `Payout`: id, businessId, stripePayoutId, amountCents, feeCents,
  arrivedAt.

Webhooks: verified via signature; idempotent via stored event IDs
(existing pattern).

## Fees shown

Every payment row shows fee + net to the business. Customer never sees
fees. Platform fee 0 at launch (configurable later).

## Permissions

| Action | Owner/Admin | Others |
|---|---|---|
| Connect Stripe / payouts | ✅ | ❌ |
| Refund | ✅ | ❌ |
| Pay (customer link) | ✅ (token) | ❌ |

## Tenant isolation

Stripe account per business; intents created with the business's account
only. Negative test: Business B cannot charge via Business A's account.

## Edge cases

1. Webhook arrives before the DB write → idempotent upsert.
2. Duplicate webhook → ignored via event ID.
3. PAD fails after 3 days → reversal flow, invoice reopened.
4. Test mode vs live: explicit banner; live requires user approval
   (standing rule).
5. Currency: CAD only (enforced).

## Out of scope

- Interac e-Transfer (C2).
- Financing (C8).

## Acceptance tests

| ID | Test |
|---|---|
| C1-001 | Unit: intent amount = stored balance (never client-supplied). |
| C1-002 | Unit: fee math (card vs PAD). |
| C1-003 | Unit: webhook idempotency (duplicate delivery). |
| C1-004 | DB: cross-business isolation. |
| C1-005 | E2E (test mode): card payment → invoice paid, fee shown. |
| C1-006 | E2E: PAD → "Processing" → webhook → cleared. |
| C1-007 | E2E: refund → balance restored. |
| C1-008 | E2E: "pay by bank first" above threshold. |
| C1-009 | A11y + fr-CA. |
| C1-010 | Auth matrix additions. |

## Build checklist

- [ ] Migration M22; RLS staged.
- [ ] Test mode only (no live without explicit approval).
- [ ] Feature flag `paymentsV2`.
- [ ] en-CA + fr-CA; parity green.
- [ ] Tests C1-001…010 green; CI green; report; then stop.
