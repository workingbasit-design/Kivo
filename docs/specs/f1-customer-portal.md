# F1: Customer Portal and Secure Links — Spec

**Status:** Draft — awaiting user OK before build.
**Date:** 2026-10-15
**Tier:** 1 (build first)

## Goal

Every quote and invoice gets a private, unguessable link that works without
logging in. The customer can view the document, choose optional line items,
accept with e-signature, ask for changes, pay a deposit or the balance,
download a PDF, see payment history, and request new work.

## Personas & user stories

### Customer (no account, link holder)
- As a customer, I open the link from the business's text/email and see my
  quote with the business name, line items, taxes, and total — in my language
  (en-CA or fr-CA, per my customer record).
- As a customer, I can tick/untick optional line items and see the total
  update before I accept.
- As a customer, I accept by typing my name, checking "I agree", and tapping
  Accept. I see a confirmation with the timestamp.
- As a customer, I can tap "Request changes" and type what I want different;
  the business sees my message on the quote.
- As a customer, I can pay a deposit (if the quote/invoice requires one) or
  the full balance by card, and see my payment history on the invoice.
- As a customer, I can download the quote/invoice as a PDF.
- As a customer, I can tap "Request new work" and describe what I need; it
  arrives as a lead draft for the business.

### Owner / Admin
- As an owner, I can copy a private link for any quote/invoice and send it
  myself, or have the app include it in messages.
- As an owner, I can revoke a link; the customer then sees "This link is no
  longer valid."
- As an owner, I see the moment a quote is accepted (status flips to
  APPROVED immediately, with signature timestamp, IP, and user agent stored).
- As an owner, I can set a link expiry (7/14/30 days, or never).

### Dispatcher / Technician
- No portal admin access. (Technicians see only their "My day" view — F4.)

## Screens (390px ASCII)

### Quote view (customer)
```
+--------------------------------------+
|  Maple Leaf Plumbing        [FR]     |
|  Quote Q-1042 · Valid until Nov 5    |
+--------------------------------------+
| Drain cleaning          $149.00      |
| [x] Camera inspection   $ 89.00     |  <- optional, ticked
| [ ] Priority scheduling $ 25.00     |  <- optional, unticked
| ------------------------------------|
| Subtotal                $238.00      |
| GST (5%)                $ 11.90      |
| Total                   $249.90      |
+--------------------------------------+
| [ ] I agree to this quote            |
| Name: [____________]                 |
| [      Accept quote      ]            |
| [ Request changes ]  [ Download PDF ]|
+--------------------------------------+
```

### Invoice view (customer)
```
+--------------------------------------+
|  Maple Leaf Plumbing        [FR]     |
|  Invoice INV-0031 · Due Nov 14       |
|  Balance owing: $249.90              |
+--------------------------------------+
| [ Pay $249.90 ]  [ Pay deposit $50 ] |
+--------------------------------------+
| Payments                             |
| Oct 15 · Card ····4242    $ 50.00    |
+--------------------------------------+
| [ Download PDF ]  [ Request new work ]|
+--------------------------------------+
```

### Revoked / expired
```
+--------------------------------------+
|  This link is no longer valid.       |
|  Please contact Maple Leaf Plumbing  |
|  at (514) 555-0100.                  |
+--------------------------------------+
```

## Data model

Existing models reused: `ShareToken` (token, type QUOTE|INVOICE, quoteId,
invoiceId, businessId, expiresAt, revokedAt), `CustomerPortalToken`.

### Changes (migration M14)
1. `ShareToken`: add `maxViews Int?` (optional view cap), `lastViewedAt
   DateTime?`. Token generation: 256-bit random (`crypto.randomBytes(32)`),
   stored as SHA-256 hash in `token` column (raw token only in the URL).
   — Actually: current column stores the raw token. Migration: keep column,
   but write only hashes going forward; existing rows re-hashed on next view.
2. New `QuoteSignature` model: id, quoteId, businessId, signerName,
   signerIp (hashed, not raw), userAgent, consentedAt, acceptedOptionIds
   Json (which optional items were selected).
3. New `PortalEvent` model (audit): id, businessId, shareTokenId, kind
   (VIEW/ACCEPT/DECLINE/CHANGE_REQUEST/PAYMENT/PDF), customerId?, meta Json?,
   createdAt. Append-only; powers "quote viewed" notifications (F10).
4. `Quote`: add `changeRequest String?` (customer's requested changes) and
   `changeRequestedAt DateTime?`.

### Token format
`https://<host>/q/<rawToken>` and `/i/<rawToken>` (already exist). Raw token
is 43-char base64url (256 bits). Rate limit: 30 req/min/IP on token routes
(existing rate-limit infra).

## Permissions

| Action | Anonymous (link) | Customer | Technician | Dispatcher | Admin/Owner |
|---|---|---|---|---|---|
| View quote/invoice via link | ✅ (token) | — | ❌ | ❌ | ✅ (app) |
| Accept quote | ✅ (token) | — | ❌ | ❌ | ❌ |
| Request changes | ✅ (token) | — | ❌ | ❌ | ❌ |
| Pay invoice | ✅ (token) | — | ❌ | ❌ | ❌ |
| Create/revoke link | ❌ | ❌ | ❌ | ❌ | ✅ |
| See signature audit | ❌ | ❌ | ❌ | ❌ | ✅ |

Server actions: `acceptQuoteViaToken`, `requestQuoteChangesViaToken`,
`recordPortalPayment` — all take the raw token, hash it, look up the
ShareToken, verify `revokedAt IS NULL` and `expiresAt > now()`, then scope
every query by the token's `businessId`.

## Tenant isolation

- Every token lookup is by hash; the businessId comes from the token row,
  never from user input.
- Cross-business guessing: token space is 2^256; Business B cannot craft a
  URL for Business A's documents. Negative test: random token → 404; A's
  token with B's business context → 404 (token row carries its own
  businessId).
- `PortalEvent` and `QuoteSignature` rows always write the token's
  businessId (fail-closed: throw if missing).

## E-signature

Typed name + consent checkbox + timestamp. Stored: signerName, consentedAt,
IP hashed with SHA-256 + daily salt (not raw IP), user agent string.
Legal note: e-signature validity for home-service contracts varies by
province — **owner to verify with a professional** before relying on it for
high-value contracts. Quebec: French version first (C4).

## Edge cases

1. Link opened twice / double-tap Accept → idempotent: second accept is a
   no-op returning the existing signature (idempotency key = token+quote).
2. Quote already APPROVED/DECLINED → link shows read-only status, no accept
   button.
3. Optional items changed by business after customer viewed → version note
   "Quote updated by the business — please review" (Quote `updatedAt` >
   first view).
4. Expired link → clear message + business contact info (no login wall).
5. Revoked link → same, with "no longer valid" wording.
6. Deposit already paid → pay button shows remaining balance only.
7. Customer language: from Customer.locale (en/fr); defaults to business
   default. All strings via existing i18n (parity test covers new keys).
8. PDF download → F2. F1 links to the PDF route; if F2 not yet built, button
   hidden behind the same feature flag.

## Feature flag

`business.featureFlags` JSON: `{ "portalV2": true }`. New portal UI and new
server actions check the flag; old `/q/[token]` page remains until flag on.
Seed: off for all existing businesses; on for new businesses after launch.

## Out of scope

- Customer accounts / passwords (single customer login is a separate
  decision; links are passwordless by design).
- Recurring portal subscriptions (F3).
- In-portal chat (request-changes is one-way with business reply by
  message, F5).
- Apple/Google Pay in portal (F1 uses card via existing Stripe test-mode
  path; C1 expands methods).

## Acceptance tests

| ID | Test |
|---|---|
| F1-001 | Unit: token generation is 256-bit, stored hashed, raw never persisted. |
| F1-002 | Unit: expired token → rejected; revoked token → rejected. |
| F1-003 | Unit: signature stores hashed IP, never raw. |
| F1-004 | DB: Business B cannot read Business A's quote via token table (hash lookup scoped). |
| F1-005 | E2E (owner): create link, copy, revoke → revoked link shows "no longer valid". |
| F1-006 | E2E (anonymous): open quote link → view, toggle optional item → total updates → accept with typed name + checkbox → status APPROVED immediately in business app. |
| F1-007 | E2E (anonymous): double-accept → single signature row (idempotent). |
| F1-008 | E2E (anonymous): request changes → business sees message on quote. |
| F1-009 | E2E (anonymous): open invoice link → pay deposit → payment history shows it; balance updates. |
| F1-010 | E2E (anonymous): random token → 404; A's token never resolves B's docs. |
| F1-011 | E2E (fr-CA): full accept flow in French, no English strings. |
| F1-012 | A11y: axe on portal pages (en + fr), zero serious/critical. |
| F1-013 | Auth matrix: new server actions added to matrix, all require token (not session). |

## Build checklist (definition of done)

- [ ] Migration M14 applied (idempotent, IF NOT EXISTS).
- [ ] RLS policies for new tables (staged, not forced — per M11 pattern).
- [ ] Server validation (zod) on all new actions.
- [ ] en-CA + fr-CA strings; i18n parity green.
- [ ] Loading / empty / error states on portal pages.
- [ ] Rate limiting on token routes.
- [ ] Feature flag gating.
- [ ] Tests F1-001…013 green; `npm test`, `tsc`, `lint`, `build` green.
- [ ] Auth matrix regenerated; drift check green.
- [ ] Mobile screenshots (390px) attached to report.
- [ ] CI green on push; report with evidence; then stop.
