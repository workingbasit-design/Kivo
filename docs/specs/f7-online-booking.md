# F7: Online Booking — Spec

**Status:** Draft — awaiting user OK before build.
**Date:** 2026-10-15
**Tier:** 1 (build after F6)

## Goal

A public booking page per business (also on the directory profile, plus an
embeddable widget for the business's own website): services with durations
and prices; real availability (working hours, buffers, existing visits,
Google Calendar busy times); approval-required or instant booking; optional
deposit; confirmation messages; CAPTCHA and rate limits.

## Current state

`BookingPage` model exists (slug, bilingual headline/intro, serviceAreas).
Public route `/book/[slug]` exists. F7 adds services, availability,
booking flow, and the widget.

## Personas & user stories

### Customer (anonymous)
- As a customer, I open the business's booking page, pick a service (with
  duration and price shown), pick an available time slot, enter my name,
  phone, address, and notes.
- As a customer, if the business requires approval, I see "Request sent —
  the business will confirm"; if instant, I see "Booked" immediately.
- As a customer, I pay the deposit online if required.

### Owner / Admin
- As an owner, I choose which services are bookable, set buffer time
  between jobs, working hours, and whether bookings need my approval.
- As an owner, booking requests arrive as notifications (F10); I approve or
  decline with one tap.
- As an owner, I copy an embed snippet (`<iframe>`) for my own website.

## Availability engine

Slot = service duration + buffer, within working hours, not overlapping
existing visits (jobs), and not overlapping Google Calendar busy times
(existing Google integration). Computed server-side per day; cached 5 min.

## Data model (migration M20)

- `BookingPage`: add `approvalRequired Boolean @default(true)`,
  `bufferMin Int @default(30)`, `depositRequired Boolean @default(false)`,
  `depositCents BigInt?`, `embedEnabled Boolean @default(true)`.
- `BookableService`: id, bookingPageId, serviceId (→ price book F6),
  businessId, position, active.
- `BookingRequest`: id, businessId, bookingPageId, serviceId, customerName,
  phone, email?, address, notes?, slotStart, slotEnd, status
  (PENDING/APPROVED/DECLINED/CANCELLED), jobId? (created on approval),
  createdAt. **Not a Job until approved** (approval-required mode).

## Anti-abuse

- CAPTCHA (Cloudflare Turnstile — free) on submit.
- Rate limit: 5 bookings/hour/IP, 20/day.
- Honeypot field.
- No customer data in URLs; confirmation page uses a one-time token.

## Permissions

| Action | Anonymous | Owner/Admin | Dispatcher |
|---|---|---|---|
| View booking page | ✅ | ✅ | ✅ |
| Submit booking | ✅ (CAPTCHA) | — | — |
| Configure page | ❌ | ✅ | ❌ |
| Approve/decline | ❌ | ✅ | ✅ |

## Tenant isolation

Booking page resolved by slug → businessId from the row. All availability
and booking writes scoped to that businessId. Negative test: slug for
Business A never shows Business B's services/slots.

## Edge cases

1. Slot taken between view and submit → "That time was just taken, pick
   another" (transactional check).
2. Business disables page → slug returns 404 with friendly message.
3. Deposit required → Stripe test-mode checkout (F1 payment path); booking
   stays PENDING until deposit succeeds.
4. Google Calendar disconnected → busy times ignored, note shown to owner.
5. Embed on third-party site → `X-Frame-Options` allowlist for the widget
   route only.

## Out of scope

- Recurring booking by customers (F3 is owner-side).
- Customer accounts for booking history (links via F1 instead).
- SMS confirmations to the customer for bookings (F5 covers once built).

## Acceptance tests

| ID | Test |
|---|---|
| F7-001 | Unit: slot computation (hours, buffers, overlaps, GCal busy). |
| F7-002 | Unit: double-book race → second submit rejected. |
| F7-003 | DB: cross-business isolation (slug/services/slots). |
| F7-004 | E2E (anonymous): book service → approval-required → PENDING + owner notified. |
| F7-005 | E2E (owner): approve → Job created with correct details. |
| F7-006 | E2E (anonymous): instant mode → Job created immediately. |
| F7-007 | E2E: CAPTCHA blocks bots (test key); rate limit enforced. |
| F7-008 | E2E (fr-CA): full booking flow in French. |
| F7-009 | A11y: axe on booking pages, zero serious/critical. |
| F7-010 | Auth matrix: new routes/actions added. |

## Build checklist

- [ ] Migration M20 (idempotent); RLS staged.
- [ ] Feature flag `bookingV2`.
- [ ] en-CA + fr-CA; parity green.
- [ ] Tests F7-001…010 green; tsc/lint/build green.
- [ ] CI green; report with evidence; then stop.
