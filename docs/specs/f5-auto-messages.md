# F5: Automatic Customer Messages — Spec

**Status:** Draft — awaiting user OK before build.
**Date:** 2026-10-15
**Tier:** 1 (build after F4)

## Goal

Booking confirmation, 24h reminder (configurable), on-my-way with ETA, job
complete + invoice link, quote follow-ups (day 2, day 7), invoice reminders
(before due, on due date, +7, +14), review request after payment. Email and
SMS. Per-customer channel + language. Quiet hours (texts 8am–8pm local by
default). CASL-compliant. Templates editable in en + fr with variables and
preview. Replaces the current view-only template list.

## Current state

`src/lib/messaging/` exists: templates.ts (view-only list), scheduler.ts,
quota.ts, consent.ts, providers.ts, email-templates.ts. F5 makes sending
real (via provider), templates editable, and adds the full event set.

## Personas & user stories

### Owner / Admin
- As an owner, I turn on "automatic reminders" and customers get a text 24h
  before their visit without me doing anything.
- As an owner, I edit the reminder text in English and French, insert
  variables ({customerName}, {date}, {time}, {businessName}, {techName}),
  and preview it before saving.
- As an owner, I see what was sent, delivered, bounced — per customer.
- As an owner, I set quiet hours; nothing texts a customer at midnight.

### Customer
- As a customer, I get a confirmation when I book, a reminder the day
  before, an "on my way" text with ETA, and the invoice link when the job
  is done — in my language.
- As a customer, every message says who it's from and how to reach them;
  I can reply STOP to opt out of texts.

## Message catalog

| Event | Default | Channel |
|---|---|---|
| Booking confirmation | immediate | email + SMS |
| Reminder | 24h before (configurable) | SMS (email fallback) |
| On my way | technician taps | SMS with ETA |
| Job complete + invoice link | on completion | email + SMS |
| Quote follow-up | day 2, day 7 | email |
| Invoice reminder | 3d before, due date, +7, +14 | email + SMS |
| Review request | after payment | email/SMS |

## CASL compliance (Canada's anti-spam law)

1. Every commercial message identifies the business and how to reach it.
2. Commercial messages include unsubscribe (email link; SMS STOP).
3. Consent records kept (`consent.ts` exists — extend): implied consent
   (existing customer, 2yr) vs express (checkbox at booking).
4. **No marketing without express consent.** Transactional messages
   (booking, reminder, invoice) are not marketing.
5. SMS STOP handled by provider webhook → consent revoked immediately.
6. **Owner to verify with a professional** that the implementation meets
   CASL for their use case.

## Quiet hours & limits

- Default: texts only 08:00–20:00 in the customer's local time
  (business timezone; configurable per business).
- Per-business monthly sending limits (quota.ts exists); owner sees usage.
- $0 constraint: SMS via provider costs money. v1: email via Resend
  (already wired) is unlimited-ish; SMS requires the business to connect
  their own Twilio (or similar) credentials — EveryJob never pays. If no
  SMS provider configured, SMS events fall back to email with a notice.

## Data model (migration M18)

- `MessageTemplate`: id, businessId, key (e.g., `reminder_24h`), channel,
  locale (en/fr), subject?, body, variables Json, active, updatedAt.
  Seed defaults per business on flag enable (en + fr).
- `MessageLog`: id, businessId, customerId?, kind, channel, locale, to,
  body snapshot, status (QUEUED/SENT/DELIVERED/BOUNCED/FAILED), providerId?,
  error?, createdAt. Powers F10 notifications + delivery tracking.
- `MessageConsent`: extend existing — add `source`, `verifiedAt`.

## Permissions

| Action | Owner/Admin | Dispatcher | Technician | Customer |
|---|---|---|---|---|
| Edit templates | ✅ | ❌ | ❌ | ❌ |
| View message log | ✅ | ✅ | ❌ | ❌ |
| Trigger "on my way" | ✅ | ✅ | ✅ | ❌ |
| Opt out (STOP) | — | — | — | ✅ |

## Tenant isolation

Templates and logs scoped by businessId. Scheduler queries per business.
Negative test: Business B cannot read/edit Business A's templates or logs.

## Edge cases

1. Customer with no phone → SMS events fall back to email.
2. Invalid phone → logged as failed, no retry storm (3 attempts, backoff).
3. Bounced email → customer flagged; owner notified (F10).
4. STOP received → immediate suppression; in-flight queued messages
   cancelled.
5. Timezone: quiet hours use business timezone; reminder "24h before" uses
   the visit's local time.
6. Quote accepted → cancel pending follow-ups.
7. Invoice paid → cancel pending reminders; send review request instead.

## Out of scope

- Marketing campaigns (explicitly not now).
- Two-way SMS conversations (STOP + confirm only).
- WhatsApp (deep links exist; API sending is a separate cost decision).

## Acceptance tests

| ID | Test |
|---|---|
| F5-001 | Unit: template variable substitution (en + fr). |
| F5-002 | Unit: quiet-hours gating (boundary times). |
| F5-003 | Unit: CASL — commercial without consent never queued. |
| F5-004 | DB: cross-business template/log isolation. |
| F5-005 | E2E (owner): edit reminder template en+fr → preview renders variables. |
| F5-006 | E2E: booking → confirmation queued; 24h reminder scheduled. |
| F5-007 | E2E (technician): "on my way" → SMS queued with ETA. |
| F5-008 | E2E: STOP → suppression; no further SMS. |
| F5-009 | E2E (fr-CA): full message flow in French. |
| F5-010 | A11y: axe on template editor, zero serious/critical. |
| F5-011 | Auth matrix: new actions added. |

**Note:** E2E uses a fake SMS/email provider (never real sends — standing
rule). Provider webhooks tested with fixtures.

## Build checklist

- [ ] Migration M18 (idempotent); RLS staged.
- [ ] Feature flag `messagingV2`; SMS provider BYO credentials.
- [ ] en-CA + fr-CA; parity green.
- [ ] Tests F5-001…011 green; tsc/lint/build green.
- [ ] CI green; report with evidence; then stop.
