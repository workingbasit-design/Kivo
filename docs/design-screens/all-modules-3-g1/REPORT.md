# Part 3 group 1 — Jobs list + Job detail: screenshot report

Reference: `docs/design/app-mockup.html` (`#jobs`, `#job`). 16 viewport shots
(390/430 px, EN/FR, light/dark) plus 2 scrolled detail shots, all with real
demo data (Maple Leaf Home Services demo business, local only).

## Jobs list vs mockup

Matches: page header with lime "+ New job", search, five filter chips with
counts (All 350 / Late 2 / Today 2 / Upcoming 30 / To invoice), "Soonest first"
+ Sort button row, group order Late (red heading) → Today, Saturday (n jobs)
→ Tomorrow, Sunday → Later → Earlier this week, trade icon tiles, time +
status/tech badges, "Not invoiced" second-line badge, amounts right-aligned.

Differences (all real-data, intended):
- Amounts show cents when not whole ($152.09) — real prices; mockup rounds.
- Times render "8:30 AM" via the shared formatter; the mockup's "8:30 a.m."
  style is Part 4 item 9 (global formatter change, not group 1).
- "Was due Sat, Oct 17" — a job due today whose start time passed is Late
  (start-time precision, new standing rule), not just past-date jobs.
- Export buttons and per-row ⋮ menus removed to match the mockup; actions
  live on the detail screen.

## Job detail vs mockup

Matches: back bar "< Jobs" + ⋮ more, trade icon tile, title, "For {customer}"
subtitle, badges (Scheduled / Late / No technician yet), when & where card
with Reschedule/Directions mini buttons, who card with avatar + "Customer
since 2026, 2 jobs" + Call/Text/Email/Profile buttons, "Assign a technician"
card with member rows + Assign buttons, sticky action bar
(Reschedule + lime "Assign Alex"). Money/notes/history verified in scrolled
shots: "Work and price" line items with HST 13% (Ontario), "Job costing"
margin bar, invoices, expenses, notes + photos, history timeline, time log.

Real-data deviations from the mockup:
- No invented availability ("Free at 2:30, 18 min away") — member rows show
  name + Assign only.
- Job has no line items in the data model: "Work and price" shows the quoted
  price + shared-engine tax.
- "No technician yet" badge only when unassigned; Email/Text buttons only
  when the customer has them.
- Checklist, expenses, time log, attachments live inside the pattern's six
  cards (mockup shows the core five); extra tools (edit, undo, cancel,
  delete, review) in the ⋮ sheet.
- Attachments card shows the Blob-storage setup hint locally (configured on
  production).

## Bugs found by screenshot QA (fixed)

1. Kit `PageHeader` h1 had no `text-ink` — title invisible in dark mode.
2. Bottom tab bar (z-40) painted over the detail sticky action bar (z-25):
   `body:has([data-pattern='detail-screen']) [data-chrome='bottom-nav']`
   now hides it (globals.css + `data-chrome` on BottomNav).
3. Invoices empty text reused the filter empty copy — new `noInvoicesYet` key.
4. Assigned member row badge said "Done" — now "Assigned" (EN/FR).

## Late rule (standing owner rule, 2026-10-17)

`isJobLate`: NEW/SCHEDULED + start time passed (`startAt` precision, else
calendar-day fallback). New `isRunningOver`: IN PROGRESS + `endAt` passed.
`isJobOverdue` (utils) aligned too — in-progress jobs no longer show Late on
Schedule/portal/tracking. Unit tests updated (43 pass in the touched files).

## Verification

- `npx tsc --noEmit`: clean
- `npm test`: 1447/1447
- `npx eslint` on touched files: 0 errors (2 pre-existing warnings)
- `npm run build`: green
- `scripts/check-design-tokens.mjs`: OK
- `scripts/check-copy-lint.mjs`: PASSED
- `scripts/check-i18n-parity.mjs`: PASSED
- Functional: assign-tech flow verified in-browser (badges + action bar
  update to "Start job").
