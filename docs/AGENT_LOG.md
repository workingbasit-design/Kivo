# AGENT_LOG.md

Session log for AI agents working on EveryJob (Kivo). Required by AGENTS.md section 1.

---

## 2026-10-13: AGENTS.md rules implementation

**Goal:** Implement the AGENTS.md rules file sent by the owner. Audit codebase against all 7 sections, fix gaps, follow definition of done.

**Files changed:** (to be filled as work progresses)

**Verified:**
- tsc --noEmit: 0 errors (2026-10-13, after launch pack push)
- Production health: 200 (2026-10-13)
- Remote: 1188a77 (launch pack #1-15)

**Not done:**
- Float to integer-cents migration (requires owner approval per AGENTS.md rule 7: rewrites data)
- Full WCAG 2.2 AA audit
- Mobile screenshots at 375px/390px for changed screens

**Open questions:**
1. Money storage: AGENTS.md requires integer cents (bigint), but schema uses Float throughout. This is a data-rewriting migration. Awaiting owner approval per rule 7. Asked 2026-10-13.
2. DONE: "Late" vs "Past due" - changed to "Late" per AGENTS.md (2026-10-13).

## 2026-10-13 (continued): AGENTS.md safe fixes

**Goal:** Implement non-breaking AGENTS.md rules.

**Files changed:**
- `src/lib/i18n/fragments/track10-work.ts`: "Past due jobs" to "Late jobs", "Past due" badge to "Late"
- `src/lib/utils.ts`: `jobDisplayStatus` returns 'LATE' not 'OVERDUE'; `statusClasses` updated; `formatStatusLabel` adds LATE (Late/En retard)
- `src/app/(app)/money/page.tsx`: removed ArrowRight icons from buttons (no arrows on buttons rule)
- `docs/AGENT_LOG.md`: created

**Verified:**
- tsc --noEmit: 0 errors
- job-time.test.mts: 9 pass, 0 fail
- CSV formula neutralization: already implemented in `src/lib/costing.ts` (`neutralizeFormulaPrefix`)
- Timezone: business.timezone used for "today" via `todayInTimezone`
- Quebec French terms: already in use (facture, etc.)

**Not done:**
- Float to integer-cents migration (awaiting approval)
- WCAG 2.2 AA audit
- Mobile screenshots at 375px/390px
