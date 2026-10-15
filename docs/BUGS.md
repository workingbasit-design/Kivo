# BUGS.md — Prompt 4 findings

Format: `ID | area | severity | status | repro | expected | actual | regression test`.
Severity: P0 = security / data loss / wrong money. P1 = broken flow. P2 = UX/polish.
**Policy: P0/P1 are fixed immediately with a regression test. P2 needs user OK before fixing.**

| ID | Area | Severity | Status | Repro | Expected | Actual | Regression test |
|---|---|---|---|---|---|---|---|
| BUG-P4-001 | Jobs Late badge | P2 | **open — awaiting user decision** | Seed or find a job with status IN PROGRESS and a start date in the past. Open /jobs and /dashboard. | The Late badge agrees on every screen. | /jobs uses `isJobLate` (NEW/SCHEDULED only → no badge); /dashboard, customer page, and portal use `jobDisplayStatus`→`isJobOverdue` (NEW/SCHEDULED/IN PROGRESS → badge shown). `src/lib/job-queries.ts:204` even documents the split. | `dates-tz.test.mts` P4-U-012 pins both behaviors until a product decision unifies them. |
