# Part D — Dashboard rebuild: charts and proof

Screenshots: `docs/design-screens/dashboard-d/` — 24 PNGs, all full-page.
- `demo-*`: demo business owner (Maple Leaf Home Services), 6 months of Toronto seed data
- `new-*`: brand-new business (Fresh Start Plumbing), zero data, onboarding done
- `tech-*`: technician "My day" (Jay M., demo business)
- Each × `en`/`fr` × `light`/`dark` × `390`/`430` px viewports
- Reference mockup: `~/workspace/mobile-qa/mockup-light.png` / `mockup-dark.png`
  (rendered from `~/workspace/user/files/EveryJob_dashboard_mockup.html`)

## What matches the mockup

- **Hi-vis direction**: lime `#D4F24C` only for the main action (New job), the active
  tab pill (Today), money bars, and the now-marker. Asphalt `#1D2024` tab bar and
  Collected card; concrete `#F2F3EF` page background. No coloured icon tiles.
- **Header**: "Saturday, October 17" in Barlow Condensed + one-line briefing
  ("4 visits today, 2 done. $5,863.60 ready to invoice.") — plural-aware, one date style.
- **Quick actions**: New job (lime) / New quote / New invoice / Record payment.
- **Collected card**: asphalt, week/month toggle, big tabular total, lime "Up 139% on
  last week", lime day bars with hatched today bar and dashed future bar, Invoiced /
  Jobs-done footer, plus a "Show the numbers" data-table disclosure (Part D).
- **Needs you**: section with count badge (59) + "See all", one action per item.
- **Key numbers 2×2**: Owed to you / Ready to invoice / Quotes waiting / New leads,
  with aging bar, technician initials, expiry and reply-time sublines.
- **Today's visits**: timeline with trade icon per visit (tap, spray, flame, squeegee),
  Done (green) / Assign (amber) / Scheduled pills, lime now-marker line + time pill.
- **Where your money is**: 6 pipeline stages with amounts, orange leak dot + inline
  "Invoice 28 jobs" CTA on the leaking stage.
- **Last 8 weeks**: dual bars (dark = Collected, grey = Invoiced), lime underline on the
  current week, "Show the numbers" disclosure.
- **Customize this screen** dashed button; tab bar with toolbox icon for Jobs and
  signal-red badges.

## What doesn't match, and why

1. **All numbers differ** — intended. The mockup's figures are hardcoded samples;
   every number in the app is computed live from the business's data (proven by the
   16 consistency tests: owed = unpaid-invoice total, ready-to-invoice = done-and-
   uninvoiced jobs, etc., across America/Toronto, America/Vancouver and
   America/St_Johns at 11:30 p.m.).
2. **Needs-you items are per-invoice, not grouped.** The mockup shows grouped summaries
   ("2 invoices are overdue — $980 total" → Remind). The app lists each overdue invoice
   (INV-0251, INV-0242…) with its own "Review invoice" action. The attention engine
   works item-by-item; grouping is a possible follow-up, not a regression.
3. **Technician header isn't tech-scoped.** The tech "My day" visit list is correctly
   filtered to Jay M.'s 2 visits, but the header briefing still shows business-wide
   numbers ("4 visits today… $5,863.60 ready to invoice"). Small inconsistency; the
   visits list is what matters for the tech, but the header should eventually scope too.
4. **Today tab icon** is a gear-like glyph; the mockup uses a sun. Minor.
5. **Known Part C follow-ups, still open**: quote "expiring within 7 days" uses the
   30-day-validity heuristic (Quote has no expiresAt/sentAt); chart bar taps link to
   /money with no per-day filter yet; the Record payment tile routes to /invoices.

## Proof summary (Part D)

- **Consistency tests** `src/lib/__tests__/dashboard-consistency.test.mts`: 16/16 pass
  (frozen 11:30 p.m. clock; Toronto, Vancouver, St_Johns). Run:
  `node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/dashboard-consistency.test.mts`
  (self-arming prisma stub registered in `register-loader.mjs`; inert for other tests).
- **Speed** `scripts/measure-dashboard-speed.mts`: 7 fetchers in parallel against the
  demo business = **133 ms** wall-clock (warm, NODE_ENV=production), under the 300 ms
  target. Fixed a real perf bug on the way: `toISODateInTimezone` built a new
  `Intl.DateTimeFormat` per call (~5,300 constructions per dashboard render); it now
  reuses one cached formatter per timezone (443 ms → 133 ms).
- **Charts**: plain CSS bars, no chart library. Screen-reader summary labels +
  `ej-figure` tabular numerals already present; data-table disclosures on both charts;
  44 px minimum tap targets; no load animation; short week/month toggle transition
  disabled under `prefers-reduced-motion`.
- **Loading**: route `loading.tsx` skeleton + per-section `Suspense` with `CardSkeleton`
  fallbacks and inline retry (from Part C).
- Full suite: **1430/1430 tests pass**; `tsc --noEmit` clean; eslint clean on changed files.
