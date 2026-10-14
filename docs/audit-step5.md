# EveryJob Audit — Step 5: Reproduce the 10 Screenshot Issues

Read-only truth audit of `~/workspace/kivo`. No application code was changed.
All line numbers verified against the current working tree (post-`1188a77` unless noted).
Important context: commit `1188a77` ("Launch pack fixes #1-15", Tue Oct 13 15:03 EDT, ~6.5h before
this audit) already fixed several of these issues in code. Each section reports the **current state**,
the **root cause of what the screenshots showed**, and a **proposed fix (NOT applied)**.

---

## 1. Jobs shows 4 jobs (3 LATE) but Schedule shows "All scheduled dates (0)" and Money says nothing outstanding

**What the code shows (filtering logic per page):**

- **Jobs page** (`src/app/(app)/jobs/page.tsx:33-42`) — NO date filter at all:
  ```ts
  const jobs = await prisma.job.findMany({
    where: { businessId, ...(activeStatus !== 'ALL' ? { status: activeStatus } : {}) },
    ...
    orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
  });
  ```
  Shows every job ever. Past-dated open jobs get the red badge via
  `jobDisplayStatus(job.status, job.date)` (page.tsx:163), which returns `'LATE'`
  when `isJobOverdue()` is true (`src/lib/utils.ts:278-284`). `isJobOverdue`
  (utils.ts:248-268) flags a job when its calendar day is before "today" **and** its status
  is in `OPEN_JOB_STATUSES`. Note: "today" defaults to `new Date()` — **server-local
  (UTC on Vercel)**, so after ~7-8 PM Toronto time a job dated *today* in the business
  timezone can already read as LATE. This explains "3 marked LATE".

- **Schedule page** (`src/app/(app)/schedule/page.tsx:83-95`) — week-grid query is date-bounded:
  ```ts
  prisma.job.findMany({
    where: { businessId, date: { gte: weekStart, lt: weekEnd } }, ...
  ```
  Jobs dated Sep 30 / Oct 4 / Oct 7 (before this week's Monday) are **excluded**.
  The "All scheduled dates (N)" button in `ScheduleClient.tsx` (~line 218) renders
  `{T('schedAllDates')} ({initialJobs.length})` — but `initialJobs` is *only the
  current-week query result*, so it prints **"(0)"** even though overdue work exists.
  There IS a separate overdue section (`page.tsx:96-117`: `date: { lt: weekStart },
  status: { in: ['NEW','SCHEDULED','IN PROGRESS'] }, take: 10`, rendered at
  page.tsx:179-216), but the "(0)" count next to the misleading "All scheduled dates"
  label contradicts it.

- **Money page** (`src/app/(app)/money/page.tsx:44-100`) — "outstanding" is defined as:
  - open quotes: `status: 'SENT'` (page.tsx:47-50)
  - unpaid invoices: `status: { not: 'PAID' }` (page.tsx:51-54)
  - overdue invoices: unpaid + `date < now - OVERDUE_AFTER_DAYS*DAY_MS` (page.tsx:56-76)
  - unbilled jobs: `status: 'COMPLETED'` **and** `invoices: { none: {} }` (page.tsx:77-95)
  - `allCaughtUp = openQuotes.length === 0 && unpaidInvoices.length === 0 && unbilledJobs.length === 0` (page.tsx:100)

  Open **NEW/SCHEDULED** jobs with no invoice are in none of these buckets — a business
  with 4 scheduled jobs and no invoices legitimately sees "all caught up".

**Root cause:** the three screens define three different universes — Jobs = everything ever,
Schedule week grid = this week only (plus a count label that lies about its scope),
Money = invoices/quotes/completed work only. Scheduled-but-uninvoiced work is invisible to Money.

**Proposed fix:**
- Change the ScheduleClient count label to count what it claims: pass `totalCount`
  (already fetched at page.tsx:95, currently only used for `allowSeed`) into the
  "All scheduled dates" button, or relabel it "This week's dates".
- On Money, add a "Scheduled, not yet invoiced" card counting open jobs
  (`status in ['NEW','SCHEDULED','IN PROGRESS']`, any date) with summed price, so
  scheduled revenue pipeline is visible.
- Make `isJobOverdue`'s default "now" use the business timezone (`todayInTimezone`)
  instead of server-local `new Date()` (utils.ts:248-252) to stop the UTC-evening LATE flip.

---

## 2. Job times in two formats ("10:00 AM" and "09:00") in the same list

**What the code shows:**

- Jobs list renders `formatJobTime(job.time, locale)` (`src/app/(app)/jobs/page.tsx:179`).
  `formatJobTime` (`src/lib/utils.ts:57-73`): canonical `"HH:MM"` → `"10:00 AM"` (en) /
  `"10 h 00"` (fr); **any non-canonical stored value falls through raw** (`if (!m) return t;`,
  utils.ts:71).
- Schedule list renders the **raw stored value**: `{hasJobTime(job.time) ? job.time : T('schedTimeTbd')}`
  (`src/components/ScheduleClient.tsx:347`) → `"09:00"`.
- Writes are normalized via `normalizeJobTime` (`src/app/actions/jobs.ts:128, 233, 332` →
  `src/lib/utils.ts:31-55`) to 24h `"HH:MM"`, but legacy rows (pre-normalization, Copilot-booked
  as `"10:00 AM"` / `"2pm"`) still sit in the column.
- Other spots also render raw: export rows `time: j.time ?? ''` (jobs/page.tsx:78),
  owner dashboard `j.time || "-"` (owner/page.tsx:279), WhatsApp messages use raw
  `job.time` (jobs/[id]/page.tsx:222, 230).

**Root cause:** two different display paths — Jobs formats (`"10:00 AM"`), Schedule shows
storage format (`"09:00"`); and `formatJobTime`'s raw-fallback (utils.ts:71) lets legacy
non-canonical values leak through unformatted, so one list can show both formats when
storage is mixed.

**Proposed fix:** use `formatJobTime(job.time, locale)` at ScheduleClient.tsx:347 (and the
other raw spots: owner/page.tsx:279, jobs/[id]/page.tsx:222,230, export row) so every list
shares one formatter; run a one-time normalization of legacy `time` values to canonical
`"HH:MM"` (local/staging first, per the DB rules) so the raw fallback has nothing to show.

---

## 3. Floating mascot (bottom-left) and robot button (bottom-right) covering content

**What the code shows:**

- Jobi mascot: `src/components/mascot/JobiMascot.tsx:294-302` —
  `position: 'fixed', left: 'max(1rem, env(safe-area-inset-left))',
  bottom: 'max(5.5rem, env(safe-area-inset-bottom))', zIndex: 40`.
  Dismissed-state restore dot at JobiMascot.tsx:266-284 (`position: 'fixed'`, same corner,
  `zIndex: 40`). Mounted in root `src/app/layout.tsx:115`, so it's on **every page**.
- Copilot ("robot") trigger button: `src/components/GlobalCopilotWidget.tsx:1505` —
  `className="fixed right-4 md:bottom-10 md:right-10 bottom-[calc(6rem+env(safe-area-inset-bottom))] w-14 h-14 ... z-50"`.
- Launch-pack `1188a77` only lowered Jobi's `zIndex` 60 → 40 (see diff of JobiMascot.tsx);
  both remain `position: fixed` overlays on every screen, and no page reserves bottom
  padding for them — they float over cards, buttons, and tab-bar content.

**Root cause:** two independent always-on fixed overlays (left z-40, right z-50) with no
content offset, no collision handling, and no per-page opt-out.

**Proposed fix:** add `pb-24`-ish bottom padding (or a spacer) to the app shell so content
never sits under the buttons; consider consolidating to one floating action cluster or
auto-hiding Jobi when the copilot panel is open / when the user scrolls to the bottom.
Do NOT just keep lowering z-index — they will still cover content, just under modals.

---

## 4. Schedule has two "Schedule new job" buttons and two date navigators

**What the code shows — already fixed by `1188a77` (pushed Oct 13 ~15:03 EDT, after the screenshots):**

Before the fix, `src/components/ScheduleClient.tsx` contained BOTH:
- a second date navigator: a day stepper with prev/next chevron buttons and a
  `"Today"` button (`shiftSelectedDay`, `handlePrevDay`, `handleNextDay`,
  `setSelectedDate('TODAY')` — removed lines ~73-153 of the old file), AND
- a second `<Link href="/jobs/new" className={primaryBtnClass}><Plus size={14} />
  {T('schedNewJobBtn')}</Link>` — removed at old line ~150-152.

Current state (verified): exactly ONE "Schedule new job" —
`src/app/(app)/schedule/page.tsx:172-174` (PageHeader action). Exactly ONE week navigator —
`src/app/(app)/schedule/page.tsx:226-254` (prev/next week arrows + "This week" link +
7-day strip). ScheduleClient's remaining date UI is the "All scheduled dates (N)" reset
button; its internal `selectedDate` still defaults to `'TODAY'` (ScheduleClient.tsx:69)
but the page overrides it with `initialDateFilter={activeDay ?? 'ALL'}` (page.tsx:341-343).

**Root cause:** duplicated CTA + duplicated day-stepper were added to ScheduleClient on top
of the page-level header/navigator.

**Proposed fix:** nothing to fix in code — verify live on production (the screenshot predates
`1188a77`; Vercel auto-deploys from main). Optionally remove the dead `'TODAY'` default /
stepper remnants in ScheduleClient.tsx:69 to prevent a future regression.

---

## 5. No day highlighted as today in week strip

**What the code shows:**

- `src/app/(app)/schedule/page.tsx:59`:
  `const todayKey = todayInTimezone(business?.timezone, business?.regionCode);`
  (`todayInTimezone` at `src/lib/utils.ts:177-180` — business timezone, defaults
  `America/Toronto`; no longer server-UTC `new Date()`).
- `src/app/(app)/schedule/page.tsx:260`: `const isToday = key === todayKey;`
- Highlight classes — `page.tsx:274`: `isToday && !isActive && 'border-lime-500 bg-lime-50'`,
  plus lime text colors at page.tsx:280 (`text-lime-700`) and page.tsx:288 (`text-lime-800`);
  aria-label announces "Today" (page.tsx:268).

**Root cause of the screenshot:** before `1188a77`, the highlight was
`isToday && !isActive && 'border-smoke'` — a barely-visible gray border that read as
"no highlight". The commit replaced it with `border-lime-500 bg-lime-50` + lime text.
(The business-timezone `todayKey` itself was already correct before this commit.)

**Proposed fix:** nothing to fix in code — verify live that today's tile shows the lime
ring. (The fix shipped in `1188a77`; screenshots were taken before it.)

---

## 6. Holiday chip truncated to "Than..."

**What the code shows** — `src/app/(app)/schedule/page.tsx:311-319`:
```tsx
{holiday && (
  <span title={holiday} aria-label={holiday} className={cn(
    'mt-1 inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px text-[9px] font-bold leading-tight',
    isActive ? 'border-white/40 bg-white/20 text-white' : 'border-amber-200 bg-amber-50 text-amber-700')}>
    <span aria-hidden>🎉</span>
    <span className="hidden sm:inline max-w-[72px] truncate">{holiday}</span>
  </span>)}
```

**Root cause:** the name span (page.tsx:317) has `max-w-[72px]` + `truncate`, so
"Thanksgiving" clips to "Than…". Additionally `hidden sm:inline` hides the name entirely
on mobile (emoji only), so phone users get no label at all. `title`/aria-label keep the
full name for hover/screen readers only.

**Proposed fix:** raise/relax the cap (e.g. `max-w-[120px]`) or let the chip wrap to two
lines on `md+`; on mobile show the full name under the day tile or keep the chip but
remove `hidden sm:inline` in favor of a smaller truncation (e.g. `max-w-[64px]`).
Keep `title={holiday}` as the fallback.

---

## 7. $0.00 job saved with no warning

**What the code shows:**

- Price validation — `src/lib/validations.ts:44-49` (`jobSchema`):
  ```ts
  price: z.coerce.number()
    .min(0, "Price can't be negative")
    .max(10_000_000)
    .transform((n) => Number(n.toFixed(2))),
  ```
  **`min(0)` — $0.00 is explicitly allowed** (same for `serviceSchema` line 57,
  `quoteSchema` ~line 66). The schema only rejects negatives.
- JobForm component: `src/components/JobForm.tsx` (used by `jobs/new/page.tsx` and
  `jobs/[id]/edit/page.tsx`). It now contains a zero-price warning:
  - detection at JobForm.tsx:86-89: `const n = parseFloat(priceValue); return priceValue.trim() !== '' && Number.isFinite(n) && n === 0;`
  - warning UI at JobForm.tsx:214-219: amber `role="alert"` box with
    `{T('formZeroPriceWarning')}` under the price field.
  - Added in `1188a77` (git show: `priceIsZero` appears in the JobForm diff).

**Root cause of the screenshot:** at screenshot time there was no zero-price warning —
`min(0)` passed silently and the form gave no feedback.

**Proposed fix:** nothing further required client-side — verify the amber warning appears
live when typing `0`. Optional hardening: keep `min(0)` in the schema (free/quote jobs are
legitimate) but note the warning is client-only — a server action saving `price: 0`
directly won't trigger it. If the product rule should be "warn, don't block", current
state is correct.

---

## 8. Status filters ordered differently on Jobs vs Schedule, labels all caps

**What the code shows:**

- Jobs tabs: `src/app/(app)/jobs/page.tsx:142` → `['ALL', ...JOB_STATUSES]`, with
  `JOB_STATUSES = ["NEW","SCHEDULED","IN PROGRESS","COMPLETED","PAID","CANCELLED"]`
  (`src/lib/validations.ts:3-10`).
- Schedule tabs: `src/components/ScheduleClient.tsx:45` →
  `const STATUS_TABS = ['ALL', 'NEW', 'SCHEDULED', 'IN PROGRESS', 'COMPLETED', 'PAID', 'CANCELLED']`.
- Both render labels via `formatStatusLabel(st, locale)` (jobs/page.tsx:151,
  ScheduleClient.tsx:258), which returns Title Case: "In progress" / "En cours"
  (`src/lib/utils.ts:86-95`, added in `1188a77`).

**Root cause of the screenshot:** before `1188a77`, ScheduleClient's tabs were
`['ALL', 'SCHEDULED', 'IN PROGRESS', 'NEW', 'COMPLETED']` (different order; PAID and
CANCELLED missing) and labels were rendered as raw SCREAMING_CASE ("IN PROGRESS" —
the all-caps). `1188a77` aligned the array to match `JOB_STATUSES` order exactly and
added `formatStatusLabel` Title-Case labels on both screens.

**Proposed fix:** nothing to fix in code — the two arrays are now identical and labels
are Title Case on both pages. Verify live. (Minor: ScheduleClient keeps its own
`STATUS_TABS` const instead of importing `JOB_STATUSES`; consider importing the single
source of truth to prevent future drift.)

---

## 9. Em dashes and en dashes in UI copy

**Counts (run 2026-10-13, current tree):**
- Em dash `—` in `src/**/*.tsx|ts`: **867** occurrences
- En dash `–` in `src/**/*.tsx|ts`: **17** occurrences
- `src/messages/` does **not exist** — translations live in `src/lib/i18n/` (`en.ts`,
  `fr.ts`, `fragments/`). Inside `src/lib/i18n/`: **53** em dashes, **0** en dashes.
- **Zero `.tsx` files contain an em dash** (`grep -rln "—" src/ --include='*.tsx'` → empty).
  All em dashes are in `.ts` files.

**Top files (em dash count):** `src/lib/copilot/engine.ts` (100), `src/lib/help-articles.ts`
(65), `src/lib/copilot/parse.ts` (45), `src/lib/messaging/email-templates.ts` (30),
`src/lib/i18n/fr.ts` (27), `src/lib/i18n/en.ts` (26), `src/app/api/copilot/route.ts` (20),
`src/lib/tenant-guard.ts` (15).

**Where they are user-visible:** i18n strings (en.ts:26, fr.ts:27) — e.g.
`newJobSubtitle: 'Fill the essentials — under 20 seconds.'` (en.ts:76),
`errorRetry: 'Could not book the job — please try again.'` (en.ts:166); email templates;
help articles. En dashes in UI-rendered strings: `src/lib/working-hours.ts:102-104`
(`Mon–Fri · 9:00 AM – 6:00 PM` shown on business-hours UI), `src/lib/messaging/engine.ts:591`
(`Quiet hours (9:00–17:00 …)`). Most remaining em dashes are in Copilot system prompts /
internal strings and code comments.

**Root cause:** no style rule; copy was written with em/en dashes across AI prompts, i18n
strings, and comments alike.

**Proposed fix:** adopt hyphen-only for user-facing copy: replace `—`/`–` in
`src/lib/i18n/en.ts`, `src/lib/i18n/fr.ts`, `src/lib/i18n/fragments/*.ts`, email templates,
help articles, and UI-rendered helpers (`working-hours.ts`, `messaging/engine.ts:591`).
Leave Copilot-internal system prompts and code comments as low priority (or normalize
them too for consistency — they're the bulk of the 867). `1188a77` already started this
(e.g. a comment em dash → hyphen in ScheduleClient.tsx).

---

## 10. Two product names (Kivo and EveryJob)

**Counts:**
- Case-sensitive `"Kivo"`: **1 file** — `src/app/actions/directory.ts:102`, a code comment:
  `/** Phone validation — Canada-only. The old IN fallback was pre-Canada Kivo ... */`
  Not user-facing.
- Case-sensitive `"EveryJob"`: **159 files**.
- Case-insensitive matches are all technical identifiers, none user-facing:
  `kivo-locale` (cookie, 16), `kivo_session` / `kivo_customer_session` (cookies, 8+2),
  `KIVO_ADMIN_EMAILS` (env var, 7), `kivo-outbox` (queue, 1), and `kivo-nine-silk.vercel.app`
  (the actual Vercel deployment hostname, ~10 references in sitemap/robots/meta).

**Root cause:** leftover from the Sep 2026 Kivo → EveryJob rename: one stale comment and
infra identifiers (cookies/env/queue names) still use the old name. The production URL
itself is `kivo-nine-silk.vercel.app`, which is the deployment hostname, not UI copy —
but users see it in the address bar.

**Proposed fix:** reword the directory.ts:102 comment to drop "Kivo"; rename cookies/env/
queue on a major version boundary (they're stored client-side / in env — renaming breaks
existing sessions, so keep until a session rotation); long-term, point the production
domain at an everyjob.* hostname since the address bar still says "kivo".

---

## Cross-cutting note

Issues **4, 5, 7, 8** (duplicate schedule buttons/navigators, today highlight, $0 warning,
status filter order/caps) and parts of **3** (Jobi z-index) and **9** (some dashes) were
fixed in code by commit `1188a77` (Oct 13 ~15:03 EDT) — **after** the user's screenshots
were taken but **before** this audit. The remaining code-level gaps are issues **1**
(three screens, three definitions of "what counts"), **2** (two time formatters + raw
fallback), **6** (holiday chip truncation), **9** (dashes in UI copy), and **10**
(stale Kivo references). Per the standing rules, each proposed fix above needs the
user's per-item go-ahead plus live production verification — commit state ≠ shipped-and-seen.
