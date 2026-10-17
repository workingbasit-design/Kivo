# Part A — Fix these first (dashboard rebuild)

Spec: `docs/PROMPT-DASHBOARD.md` Part A. Replaces nothing else; E1's dashboard work stays.

## 1. One definition of "today" (business timezone)

**Root cause found:** `dayRange()` in `src/lib/utils.ts` builds the day window with
`new Date(y, m - 1, d)`, which is midnight *server*-local. On Vercel (UTC) that
instant is 4–5 hours off the business day, so "today's" queries showed the wrong
day's jobs in the evening — while the attention engine already keyed days in the
business timezone. The two disagreed exactly as the user's screenshots showed.

**Fix:**
- `src/lib/utils.ts`: new `dayRangeInTimezone(dateStr, timeZone)` anchors both
  ends at midnight in the business timezone (built on the existing
  `parseDateInputInTimezone`); `todayInTimezone()` gained an injectable `now`
  for tests.
- `src/lib/dashboard.ts`: `getDashboardStats` and `getReportStats` use the new
  range. Other `dayRange()` callers (Schedule, dispatch, copilot, …) are
  unchanged — converting them is a follow-up, not Part A.
- Test: `src/lib/__tests__/today-boundary.test.mts` pins 10:47 p.m.
  America/Toronto (= next day in UTC): still "today" Oct 17, window
  `04:00Z Oct 17 → 03:59:59.999Z Oct 18`; plus EST and Vancouver cases.

## 2. Plurals

- New `src/lib/i18n/plural.ts`: `tp(locale, path, count, vars)` picks the
  `{one, other}` form with `Intl.PluralRules` (French treats 0 and 1 as
  singular) and fills `{vars}`. "1 jobs" is impossible by construction.
- Converted: `nav.jobsLeft`, `dashboard.unpaidInvoices`,
  `dashboard.readyToInvoiceCount` ("1 jobs ready to bill" is fixed),
  `attention.subtitle`, `attention.items.overdueInvoice.detail`,
  `attention.items.quoteFollowUp.detail`, `attention.items.paidThisWeek.title`
  (EN + FR).
- `AttentionItem.plural = { key: 'title'|'detail', count }` set in
  `computeAttention`; `AttentionRow` renders those lines through `tp()`.
  Sidebar and `/attention` page converted to `tp()` as well.
- Test: `src/lib/__tests__/plural.test.mts` renders every converted message
  with 0, 1 and 2 in EN and FR against exact expected strings, plus an
  explicit "no plural noun after 1" assertion.

## 3. Briefing copy

- No quotation marks around job titles (EN “”, FR « » removed).
- Title names the job + state on one line; the customer leads the next line:
  `Gutter cleaning hasn’t started` / `Daniel Okafor, Tomorrow`.
- The `For {customer}. Assign someone…` fragment is gone
  (`{customer}, {date}` instead).
- Greeting matches the business's local time: new pure `daypartGreeting()`
  in `src/lib/attention.ts` (EN morning/afternoon/evening; FR Bonjour/Bonsoir),
  threaded through a new optional `timezone` prop on `AttentionBriefing`.
  (Verified live: "Good morning" at 12:30pm → "Good afternoon" at ~1pm.)
- Copy lint passes (no middle dots — commas used; no em dashes).

## 4. One date style

- Dashboard upcoming jobs now use the shared `formatDisplayDate()`
  ("Tomorrow", "Mon, Oct 19") instead of `DateTimeText variant="short"`
  ("Oct 18, 2026") — the schedule and the briefing agree.

## Screenshots

`docs/design-screens/dashboard-a/`: before/after at 390 px and 430 px,
EN + FR, light mode only (the app has no dark mode yet — Part B).
Captured with `scripts/shots-dashboard-a.mjs` (Firefox; local Chromium is
blocked by its Local Network Access check).

## Verification

- `npm run lint`: 0 errors (130 pre-existing warnings)
- `npx tsc --noEmit`: clean
- `npm test`: 1386/1386 pass (30 new: 6 today-boundary, 16 plural, 8 greeting)
- `npm run build`: success
- i18n parity: 3532 keys each direction, passed
- copy lint: passed

## Open questions / follow-ups (not Part A)

- Remaining `dayRange()` callers outside the dashboard still use the
  server-local window (Schedule, dispatch, voice, copilot, notifications,
  routes, booking-slots, route-optimizer). Convert when those surfaces are
  touched.
- `leaks.*`, `owner.*`, `health.*` fragments still have non-plural count
  strings (owner mode / money-leaks pages) — same `tp()` treatment applies.
- `dashboard.jobStillOpen(s)` / `dashboard.totalCustomers` keys are unused;
  left as-is.
