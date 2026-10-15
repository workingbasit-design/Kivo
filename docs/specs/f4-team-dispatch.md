# F4: Team, Roles, and Dispatch — Spec

**Status:** Draft — awaiting user OK before build.
**Date:** 2026-10-15
**Tier:** 1 (build after F3)

## Goal

Four roles with a real permissions matrix. Dispatch assigns visits with
double-booking warnings. Technicians get a "My day" view: visits in order,
maps link, notes, photos, checklist, mark complete, customer signature.
Clock in/out per visit; timesheet CSV export.

## Current state

`Membership.role`: OWNER | ADMIN | DISPATCHER | TECHNICIAN (exists).
`Job.assignedToId` / `crewId` exist (partial). `TimeEntry` model exists
(clockIn/clockOut per job). F4 wires these into a complete system.

## Permissions matrix

| Capability | Owner | Admin | Dispatcher | Technician |
|---|---|---|---|---|
| Manage team (invite/remove/roles) | ✅ | ✅ | ❌ | ❌ |
| See prices, invoices, reports | ✅ | ✅ | ✅ | ❌ (default) |
| Create/edit jobs & schedule | ✅ | ✅ | ✅ | ❌ |
| Assign visits / dispatch | ✅ | ✅ | ✅ | ❌ |
| View all jobs | ✅ | ✅ | ✅ | ❌ (own only) |
| My day, mark complete, photos | ✅ | ✅ | ❌ | ✅ |
| Clock in/out | ✅ | ✅ | ❌ | ✅ |
| Customer contact info | ✅ | ✅ | ✅ | ✅ (visits only) |
| Settings / billing | ✅ | ❌ | ❌ | ❌ |

Default: technicians don't see prices, invoices, or reports. (Owner can
grant "see prices" per technician via flag — out of scope for v1.)

Enforcement: server-side `requireRole()` helper in every action + API
route; the matrix is unit-tested (role × capability). UI hides, server
denies.

## Personas & user stories

### Owner / Admin
- As an owner, I invite a technician by email; they set a password and see
  only "My day".
- As an owner, I assign a visit to one or more technicians; if either is
  already booked at that time, I see "Marc is already on Job 1041 9:00–11:00"
  and confirm or pick someone else.

### Dispatcher
- As a dispatcher, I see the day's visits with assignees and drag (or tap)
  to reassign.

### Technician
- As a technician, I open "My day" and see my visits in time order. I tap
  the address to open maps, read notes, follow the checklist, add photos,
  mark complete, and capture the customer signature.
- As a technician, I clock in when I arrive and clock out when I leave;
  the owner sees my hours.

## Screens (390px ASCII)

### My day (technician)
```
+--------------------------------------+
|  My day · Wed Oct 15        [Clock in]|
+--------------------------------------+
| 9:00  Drain cleaning                 |
|       123 Main St [maps]             |
|       Notes: side door               |
|       [ Start ]                      |
+--------------------------------------+
| 11:30 Camera inspection              |
|       456 Oak Ave [maps]             |
|       [ Start ]                      |
+--------------------------------------+
```

### Visit detail (technician)
```
+--------------------------------------+
| < Back          Drain cleaning       |
| Customer: Jane Doe · (514) 555-0100  |
| 123 Main St [Open in maps]           |
+--------------------------------------+
| Notes: side door, dog inside         |
| Checklist:                           |
| [x] Shut off water  [ ] Test drain   |
| Photos: [+ Add]  [img][img]          |
+--------------------------------------+
| [Clock in]  [Mark complete]          |
| Customer signature: [Sign]           |
+--------------------------------------+
```

## Data model (migration M17)

- `JobAssignment`: id, jobId, userId, businessId, assignedAt. (Replaces
  single `assignedToId` for multi-tech; keep column for compat.)
- `JobChecklistItem`: id, jobId, businessId, label, done, position.
- `VisitSignature`: id, jobId, businessId, signerName, signedAt, signature
  data URL (stored in Blob, not DB).
- `TimeEntry` exists — add `approvedAt`, `approvedById` (owner approves
  timesheets).
- Double-booking check: query overlapping assignments per user per time
  window (unit-tested).

## Tenant isolation

All assignment/signature/time queries scope by businessId. Technician
"My day" filters `JobAssignment.userId = me AND job.businessId = my
business`. Negative test: technician from Business B sees nothing of
Business A.

## Edge cases

1. Technician removed mid-day → their assignments stay but show "former
   member"; owner reassigns.
2. Clock in without clock out → auto clock-out at midnight + flag.
3. Overlapping visits for same tech → warning, owner overrides with reason
   logged.
4. Photos: existing attachments infra; 10MB cap; HEIC handled by Blob.
5. Signature: typed name + drawn stroke; stored as image in Blob.
6. Offline: technician actions queue and sync (v1: show "no connection"
   state; full offline queue is out of scope).

## Out of scope

- GPS tracking of technicians (explicitly not now).
- Payroll (timesheet CSV export only).
- Per-technician price visibility toggle (v1: default hidden).

## Acceptance tests

| ID | Test |
|---|---|
| F4-001 | Unit: permissions matrix — every role × capability, incl. technician price hiding. |
| F4-002 | Unit: double-booking detection (overlap logic). |
| F4-003 | DB: Business B technician sees none of Business A's visits. |
| F4-004 | E2E (owner): invite technician → assign visit → double-book warning appears. |
| F4-005 | E2E (technician): My day lists own visits in order; cannot open others' visits (403). |
| F4-006 | E2E (technician): complete visit flow — checklist, photos, signature, mark complete. |
| F4-007 | E2E (technician): clock in/out → timesheet shows hours; owner exports CSV. |
| F4-008 | E2E (technician): prices/invoices/reports return 403 or hidden. |
| F4-009 | E2E (fr-CA): My day + visit detail in French. |
| F4-010 | A11y: axe on team pages, zero serious/critical. |
| F4-011 | Auth matrix: new actions/routes added; role-gated. |

## Build checklist

- [ ] Migration M17 (idempotent); RLS staged.
- [ ] `requireRole()` enforced server-side everywhere; matrix unit-tested.
- [ ] Feature flag `teamV2`.
- [ ] en-CA + fr-CA; parity green.
- [ ] Loading/empty/error states; 48px targets (gloves).
- [ ] Tests F4-001…011 green; tsc/lint/build green.
- [ ] CI green; report with evidence; then stop.
