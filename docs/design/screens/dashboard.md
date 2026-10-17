# Part C brief — dashboard section-by-section rebuild (released)

Goal per the user's directive ("I want exact same design"): the dashboard
renders the mockup's layout exactly — condensed date header with the
visits/invoice summary line, four quick-action tiles (lime New job, New quote,
New invoice, Record payment), the dark Collected card with the This week/This
month toggle, lime money bars with day labels, the "Up N% on last week" delta
line, the Invoiced / Jobs done figures row, the Needs you section with count
badge + See all, then Key numbers, Today's visits (reflective stripe + lime
now-marker), Where your money is, Last 8 weeks, and Customize this screen.
Lime stays on the main action, active tab, money bars, and now marker only.
The mockup's numbers are placeholders; the page renders the user's real data
in the identical layout.

## Data-layer decisions (all tenant-scoped by businessId, business-timezone days)

- "Today" is the business-timezone day (`dayRangeInTimezone`).
- **Lead first-reply definition (resolved, no new column):** the Lead model has
  no first-response column. Part C defines avg first reply and oldest waiting
  from `Communication` rows exactly as the Part 0 seed did: for leads that
  have been REPLIED, first-reply time = `Communication.updatedAt −
  waitingSince`; oldest waiting = max(now − waitingSince) over WAITING rows.
  This is the documented definition; no schema change was needed.
- Quote "expiring within 7 days" = SENT quotes with updatedAt 23-30 days ago
  (30-day validity heuristic — the Quote model has no expiresAt/sentAt;
  flagged as a data-model follow-up, not improvised into the schema).
- "Approved, not scheduled" = NEW jobs with no date/time (the schema has no
  quote→job link, so this is the closest honest definition).
- Invoice dates are treated as UTC-calendar = business-local (existing
  revenue.ts convention).
- Bar taps link to `/money` (the Money page has no per-day filter yet, so
  per-day payment deep-linking is a documented follow-up).

## Layout + sections

- `DashboardLayout` model (migration m28_dashboard_layout): per-user
  `{key, visible}` section order, role defaults (OWNER/ADMIN see all money
  sections; DISPATCHER hides them; TECHNICIAN gets "My day" with their visits
  only). Customize panel reorders/toggles/resets via a zod-validated
  `saveDashboardLayout` server action. `DashboardLayout` was added to
  `TENANT_MODELS` and the guard's compound-key list (`userId_businessId`).
- Sections fail independently: per-section Suspense skeletons + a client error
  boundary with a retry button (inline, never a page crash).
- Quick actions: New job (lime), New quote, New invoice, Record payment.
  "Record payment" goes to /invoices because payments are recorded on invoice
  detail pages — there is no standalone payment form.
- Collected card is asphalt in BOTH light and dark mode (per the mockup).
  "Show the numbers" expands a plain data table in Last 8 weeks.

## Verification

- `npx tsc --noEmit` clean; `npm test` 1414/1414; eslint 0 errors on changed
  files; `npm run build` succeeds; copy-lint passes; i18n parity 3652/3652.
- Screenshots: `docs/design-screens/dashboard-c/` — dashboard at 390/430px,
  EN/FR, light/dark (8 PNGs), captured against the seeded demo business.
- Fixed opportunistically: `scripts/seed-staging.ts` now hashes with bcrypt
  (the app verifies with bcrypt; the old pbkdf2 format could never log in).
