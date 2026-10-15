# F10: Notifications and Search — Spec

**Status:** Draft — awaiting user OK before build.
**Date:** 2026-10-15
**Tier:** 1 (build after F9)

## Goal

The bell shows real events (new lead, quote accepted, payment received,
invoice overdue, booking request) with read/unread state, following Settings
preferences. Search across customers, jobs, quotes, invoices — within the
business only.

## Current state

Notification model exists (in-app). `PortalEvent`/`MessageLog` (F1/F5) feed
it. Search exists partially. F10 completes both.

## Personas & user stories

### Owner / Admin / Dispatcher
- As an owner, I tap the bell and see "Quote Q-1042 accepted by Jane Doe —
  2 min ago", unread highlighted. I tap it and land on the quote.
- As an owner, I turn off "review request" notifications in Settings; I
  stop getting them.
- As a dispatcher, I search "Tremblay" and see the customer, their jobs,
  quotes, and invoices — only my business's.

### Technician
- As a technician, I see job-related notifications for my visits only.

## Events (v1)

New lead, quote accepted/declined, change requested, payment received,
invoice overdue, booking request (F7), message bounced (F5), review
received. Each: icon, text (en/fr), deep link, timestamp, read/unread.

## Data model (migration M21)

- `Notification`: extend existing — add `kind`, `entityType`, `entityId`,
  `businessId` (exists?), `readAt`.
- `NotificationPreference`: id, businessId, userId, kind, enabled.
  Defaults: all on.

## Search

Single search box (header). Searches customers (name/phone/email),
jobs (title/number), quotes, invoices — business-scoped, ranked, max 20
results grouped by type. Debounced 200ms. No full-text engine (ILIKE on
indexed columns; fine at this scale).

## Screens (390px ASCII)

### Notifications (bell)

```
+--------------------------------------+
|  < Notifications        [Mark all   ] |
|                          [read]      |
|                                      |
|  ● Quote Q-1042 accepted             |
|    Jane Doe · 2 min ago        [ > ] |
|  ● Payment $249.90 received          |
|    Invoice INV-0031 · 1h ago   [ > ] |
|  ○ Booking request: Drain cleaning   |
|    Tue Nov 3, 9:00 · 3h ago    [ > ] |
|  ○ Invoice INV-0028 overdue (7d)     |
|    $189.00 · yesterday         [ > ] |
+--------------------------------------+
```

### Global search (header)

```
+--------------------------------------+
|  [Search customers, jobs...      ]   |
|                                      |
|  Customers                           |
|  Jane Doe · (416) 555-0100      [ > ]|
|  Tremblay Inc · (514) 555-0101 [ > ]|
|  Jobs                                |
|  #J-2041 Drain cleaning · Nov 3 [ > ]|
|  Invoices                            |
|  INV-0031 · $249.90 · Unpaid    [ > ]|
+--------------------------------------+
```

## Permissions

| Action | Owner/Admin | Dispatcher | Technician |
|---|---|---|---|
| View all notifications | ✅ | ✅ | own only |
| Change preferences | ✅ (own) | ✅ (own) | ✅ (own) |
| Search | ✅ | ✅ | own jobs/customers |

## Tenant isolation

Notifications and search filter by businessId. Negative test: Business B
search never returns Business A's records; B's bell never shows A's events.

## Edge cases

1. Notification for a deleted entity → "no longer available" state.
2. High volume → paginated, "mark all read".
3. Search with 1 char → hint "type at least 2 characters".
4. Preferences respected at creation time (don't create disabled kinds).

## Out of scope

- Push notifications to phones (PWA push is a separate decision).
- Email digests (F5 covers transactional).

## Acceptance tests

| ID | Test |
|---|---|
| F10-001 | Unit: event → notification text (en + fr). |
| F10-002 | Unit: preferences filter event creation. |
| F10-003 | DB: cross-business isolation (search + notifications). |
| F10-004 | E2E (owner): quote accepted → bell badge → tap → lands on quote → marks read. |
| F10-005 | E2E: preference off → no notification created. |
| F10-006 | E2E: search "Tremblay" → grouped results, business-only. |
| F10-007 | E2E (technician): sees only own-visit notifications. |
| F10-008 | E2E (fr-CA): notifications + search in French. |
| F10-009 | A11y: axe, zero serious/critical. |
| F10-010 | Auth matrix: new actions added. |

## Build checklist

- [ ] Migration M21 (idempotent); RLS staged.
- [ ] Feature flag `notificationsV2`.
- [ ] en-CA + fr-CA; parity green.
- [ ] Tests F10-001…010 green; tsc/lint/build green.
- [ ] CI green; report with evidence; then stop.
