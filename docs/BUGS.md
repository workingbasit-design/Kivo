# BUGS.md — Prompt 4 findings

Format: `ID | area | severity | status | repro | expected | actual | regression test`.
Severity: P0 = security / data loss / wrong money. P1 = broken flow. P2 = UX/polish.
**Policy: P0/P1 are fixed immediately with a regression test. P2 needs user OK before fixing.**

| ID | Area | Severity | Status | Repro | Expected | Actual | Regression test |
|---|---|---|---|---|---|---|---|
| BUG-P4-001 | Jobs Late badge | P2 | **fixed 2026-10-15** (user decision: "Everywhere") | Seed or find a job with status IN PROGRESS and a start date in the past. Open /jobs and /dashboard. | The Late badge agrees on every screen. | ~~`/jobs` used `isJobLate` (NEW/SCHEDULED only → no badge); `/dashboard`, customer page, and portal used `jobDisplayStatus`→`isJobOverdue` (NEW/SCHEDULED/IN PROGRESS → badge shown).~~ Unified: `LATE_ELIGIBLE_STATUSES` now includes IN PROGRESS; `isJobLate` and `isJobOverdue` agree. | `dates-tz.test.mts` P4-U-012 asserts IN PROGRESS → late. |
