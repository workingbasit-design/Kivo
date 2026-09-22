# Kivo Directory — build & verification notes

Date: 2026-09-22. The customer-discovery layer ("Jobber of India" growth engine):
free lead generation for providers, "find a pro" search for customers. No
commissions, no payments, no auto-messaging — ever.

## What was built

**Public pages (no auth, tenant-safe by construction)**
- `/directory` — server-rendered search by service keyword + city, min-rating
  filter, graceful empty state ("No pros found yet — be the first in your
  city" + register CTA). Only `directoryOptIn` businesses with a booking page
  are listed; only public-safe fields selected.
- `/p/[slug]` — rich SEO business profile: semantic HTML, meta title /
  description / OG tags, JSON-LD `LocalBusiness` (+ aggregateRating), services
  with prices, working-hours summary, WhatsApp `wa.me` deep link, tap-to-call,
  locality display, reviews (aggregate + latest 5), "Leave a review" via the
  existing `/r/[businessId]` flow, "Book now" via `/book/[slug]`, and a
  "Report this business" form.
- `/directory/request` — "Request quotes" flow: service needed, city/area,
  name, phone (validated via `lib/phone.ts`, IN-or-CA accepted, stored as
  E.164 `phoneNorm`). On submit, creates a `Lead` draft (`status NEW`,
  `source "Directory"`, details prefixed "Directory quote request") in up to
  5 matching providers' inboxes (service keyword × city). Providers choose to
  respond — nothing is sent anywhere. Customer sees a confirmation naming the
  businesses that received the request. Rate-limited: **5/hour/IP**.
- Trust: phone-verified badge (business phone/WhatsApp validates via
  libphonenumber), report form → `DirectoryReport` row (`OPEN`), admin queue
  at `/directory-reports` gated by the `KIVO_ADMIN_EMAILS` env var
  (comma-separated); non-admins see "Not authorized".

**Opt-in model (supply on day one)**
- `Business.directoryOptIn` (default `true`), `Business.directoryHideAddress`
  (default `true` → profile shows locality "Andheri West, Mumbai", never the
  exact address). Toggles in Settings → "Kivo directory" section.
- Saving settings with opt-in ON and no booking page auto-creates one, so
  every opted-in business gets a stable `/p/[slug]` link.

**Schema**
- `Business`: `+ directoryOptIn Boolean @default(true)`,
  `+ directoryHideAddress Boolean @default(true)`.
- New `DirectoryReport` model (business FK cascade, reason/details/
  reporterContact/status `OPEN|REVIEWED|DISMISSED`, indexes on businessId,
  status). Relation `Business.directoryReports`.
- `prisma generate` + `db push` clean (SQLite dev).

**Other changes**
- `src/proxy.ts`: `/directory`, `/directory/request` exact + `/p/` prefix are
  public (no login redirect).
- `src/lib/rate-limit.ts`: `QUOTE_REQUEST_LIMIT` (5/hr), `REPORT_LIMIT` (5/hr).
- `src/lib/directory.ts`: `publicClientIp`, `localityFromAddress` heuristic,
  `isPhoneVerified`, `matchesServiceKeyword`, `matchesCity`, `ratingSummary`,
  `isDirectoryAdminEmail`.
- `src/app/actions/directory.ts`: `findDirectoryMatches`, `submitQuoteRequest`,
  `reportBusiness`, `updateReportStatus` (admin-only).
- `src/app/sitemap.ts`: `/directory` added (daily, priority 0.9).

## Verification (Playwright, /tmp/chromium)

39/39 assertions PASS — full log at `~/workspace/kivo-shots/directory/results.log`,
screenshots in `~/workspace/kivo-shots/directory/` (`01-profile.png` …
`11-mobile-profile.png`):
- Profile: 200, SEO title/meta/JSON-LD, services, 4.5★ aggregate, verified
  badge, wa.me link, exact address hidden, locality shown, Book CTA.
- Isolation: opted-out → 404, unknown slug → 404, opted-out never listed,
  cross-city excluded from search and from quote-request leads.
- Search: keyword+city match, unfiltered list, empty state, minRating filter.
- Quote request: confirmation names receivers, exactly one NEW "Directory"
  lead draft in the right tenant's inbox (visible at `/leads`), phone
  normalized, invalid phone rejected with the friendly message, 6th
  request/hour blocked by rate limit.
- Reports: submission confirmed, stored OPEN; `/directory-reports` shows
  "Not authorized" without `KIVO_ADMIN_EMAILS`.
- Settings: opt-in checked by default; uncheck → profile 404 + vanishes from
  search; re-check → 200.
- Mobile 390×844: directory + profile render cleanly.
- Regression smoke: `/dashboard` 200, `/book/[slug]` 200 — release-pass
  fixes (share tokens, idempotency, etc.) untouched.

`npx tsc --noEmit` clean, `npm run build` green (one fix needed mid-build:
a sync helper exported from a `'use server'` file — moved to `lib/`).

## Test-data cleanup

All directory QA businesses/users removed via SQL (raw deletes bypass
Prisma cascade emulation, so orphaned `BookingPage`/`Service`/`Review`/
`Session`/`DirectoryReport`/`Lead` rows were explicitly purged too).
Final: **0 businesses, 0 users, 0 rows** in every table — DB as found.

## Accepted risks / follow-ups

- City matching is a loose substring match on the free-text address (no
  dedicated city column) — good enough for V1, may miss spelling variants.
- `localityFromAddress` is a last-two-segments heuristic; odd address
  formats degrade gracefully to showing less, never more.
- Rate limiter is in-memory (single instance) — same documented limitation
  as the rest of the app; needs Redis/Upstash for multi-instance prod.
- Directory admin is a single env var (`KIVO_ADMIN_EMAILS`); no admin UI
  beyond the reports queue. Reports have no provider-appeal flow yet.
- No de-duplication of repeat quote requests from the same phone (each
  submit = one lead draft per provider); acceptable for V1, watch for spam.
- Quote-request matching caps at 5 providers, first-alphabetical among
  matches — no ranking by rating/distance yet.
- Production DB is still SQLite; directory queries are simple selects and
  will migrate cleanly to Postgres.
