# Part B: Fix the mobile experience — Plan

User approved full implementation on 2026-10-14 ("OK implement everything", "Keep build all of it until all gets done"). Proceeding without per-part stop.

## B1. Mascot
- Remove floating Jobi mascot from every signed-in work screen (`(app)` layout).
- Mascot may remain only as illustration inside empty states and onboarding (not in this part — Part C may add it).
- Files: `src/app/(app)/layout.tsx`, mascot component, any global floating wrapper.

## B2. Nothing floats over content
- Move Copilot entry into top bar as icon button with `aria-label="Open Copilot"`.
- Remove floating robot button.
- Add bottom padding to scroll containers: `pb-[calc(var(--bottom-nav)+env(safe-area-inset-bottom))]` or equivalent so last item is fully visible.
- Files: top bar / header component, Copilot button, `(app)/layout.tsx`.

## B3. Schedule screen (390px wireframe)
Before:
```
[Date nav] [Date nav] [New job] [New job]
[Week strip with 0s]
[Truncated holiday chip "Than..."]
```
After:
```
[< Prev] [Today] [Next >]
[Mon 12 · 2] [Tue 13 · 0] ... (count or dots only when jobs exist)
[Agenda: time, title, customer, status, address]
[Holiday: full name in agenda header]
[Tapping empty day -> new job with that date]
```
- One week strip, one "New job" action.
- Day cells: count or dots only when jobs exist, never a row of zeros.
- Tapping a day shows agenda underneath.
- Holiday names in full in agenda header, not truncated chips.
- Remove duplicate date navigator and duplicate button.
- Tapping empty day starts new job with that date.

## B4. Jobs list
- Filter chips: sentence case, horizontally scrollable with visible edge hint (fade), same order as JOB_STATUSES, with counts.
- Move Export CSV / Export Excel into overflow menu on mobile.
- Late shows as badge next to status (use shared StatusBadge from Part A).

## B5. Money page
- One clear empty state with one next action.
- Replace three repeated "nothing here" messages with single EmptyState component.

## B6. Top bar on signed-in screens
- Page title, search, notifications, Copilot icon.
- Move EN/FR switch into More menu + profile settings. Save choice to account (persist in user/business record or cookie + DB).
- Keep EN/FR switch in header on public pages.

## B7. Copy pass
- Remove every em dash (U+2014) and en dash (U+2013) from src/. Report count before/after.
- Sentence case everywhere. No arrows appended to button text. Specific button labels.
- Replace meta lines strung with middle dots (·) by two-line layout where it helps.

## B8. Shared components
- StatusBadge (done in Part A — consolidate ui.tsx legacy version into it).
- MoneyText, DateTimeText, EmptyState, ConfirmDialog, PageHeader.
- Replace one-off versions everywhere (at minimum: Money page, Jobs, Schedule, Dashboard).

## Tests
- Copy pass: grep count before/after for em/en dashes.
- Mobile: verify at 375px/390px via Playwright screenshots (if available).
- Existing suite must stay green.

## Files (expected)
- `src/app/(app)/layout.tsx`, header/top bar, ScheduleClient, jobs page, money page, `src/components/*.tsx` (new shared components), `src/lib/i18n/*` (copy changes).
