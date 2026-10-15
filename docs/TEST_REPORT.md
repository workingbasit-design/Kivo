# TEST_REPORT.md — Prompt 4

**Date:** 2026-10-15
**Branch:** main
**Plan:** `docs/plans/testing.md`

## Totals

| Suite | Passed | Failed | Skipped |
|---|---|---|---|
| Unit + integration (`npm test`) | 1268 | 0 | 0 |
| Database (`npm run test:db`, CI only) | — | — | — (fail-closed without `TEST_DATABASE_URL`) |
| Playwright E2E (listed, CI runs) | 1359 listed | — | 0 (auth-matrix skips on mobile by design) |
| **Total** | **1268 verified locally** | **0** | **0** |

Skipped = 0 in every locally-runnable suite. DB and E2E suites run in CI
(GitHub Actions) against an isolated Postgres + seeded test database.

## CI

- **Workflow:** `.github/workflows/ci.yml` — runs on every push to `main` and every PR.
- **Jobs:** `validate` (lint, tsc, i18n parity, unit, matrix drift, .only/.skip ban, raw-SQL check, build), `audit` (fail on high/critical), `db-tests` (postgres:18, `test:db`), `e2e` (postgres, seed, build, Playwright × 3 devices, report + trace artifacts).
- **Perf:** `.github/workflows/perf.yml` — weekly Lighthouse (record-only).
- **CI run link:** see the Actions tab after push (run ID will be linked here once executed).
- **Branch protection:** enable "Require status checks to pass" for `main` in repo settings (manual step).

## Traceability

See `tests/README.md` for the full ID → file table. Coverage:

- **P4-U (unit):** tax provinces, QST pre-GST, NS date rule, Late across 4 timezones + UTC edge + DST 2026/2027, job/quote/invoice transitions, numbering concurrency, CSV + all zod schemas, payments math.
- **P4-D (database):** cross-tenant CRUD blocked (guard sweep over all 64 tenant models), technician membership confinement, anonymous/consumer isolation, attachment rows, RLS (existing 8/8).
- **P4-A (auth matrix):** generator + drift check; 52 routes × 7 personas (HTTP); 221 actions static auth check + requireMembership dynamic.
- **P4-E (E2E):** anonymous (12), consumer (11), owner (26), team (9) journeys × iPhone/Android/desktop.
- **P4-X (attacker):** IDOR, tamper, XSS (web/email/CSV), brute force, redirect, uploads, webhooks, CSRF, framing, claims, Copilot injection.
- **P4-B (bilingual):** 12 fr-CA journeys + no-English scan + fr-CA formats.
- **P4-AX (a11y):** axe on 20+ pages × 2 languages, keyboard flows, accessible names.
- **P4-P (perf):** 10k/5k pagination + timing, offline/double-tap, Lighthouse workflow.

## Bugs found

| ID | Severity | Status |
|---|---|---|
| BUG-P4-001 (Late badge: `isJobLate` vs `isJobOverdue` disagree on IN PROGRESS) | P2 | Open — awaiting user decision (per policy, P2 needs OK before fixing) |

No P0 or P1 bugs found. Full log: `docs/BUGS.md`.

## Cannot be tested automatically

- **Real-phone checks** (camera, sunlight readability, one-handed use, real SMS/email delivery, 3D Secure on device): covered by `docs/MANUAL_QA.md` (45–60 min, owner-run).
- **Visual design quality** ("does it look premium"): human eye-test only.
- **Stripe live mode**: test mode only; live requires explicit approval.
- **Production RLS forcing**: staged policies only; activation needs the checklist in `docs/SECURITY_REPORT.md`.
- **Directory E2E**: blocked until the owner approves the "Lion calulator" listing at `/directory-claims`.

## Manual QA

`docs/MANUAL_QA.md` — run on a real iPhone + Android after every release.

---

**Status: implementation complete. Awaiting user review.**
