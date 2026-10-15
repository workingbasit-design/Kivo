# Tests — traceability (Prompt 4)

How tests are organized and what each ID covers. In CI the `db-tests` and `e2e`
jobs must report **0 skipped**.

| Area | Runner | Location | IDs | Status |
|---|---|---|---|---|
| Unit: money & tax | node --test | `src/lib/__tests__/tax-provinces.test.mts`, `tax-calc.test.mts` | P4-U-001…005 | ✅ done |
| Unit: dates & timezones | node --test | `src/lib/__tests__/dates-tz.test.mts`, `booking-timezone.test.mts`, `ca-holidays.test.mts` | P4-U-010…014 | ✅ done |
| Unit: status rules | node --test | `src/lib/__tests__/quote-invoice-status.test.mts`, `job-status.test.mts` | P4-U-020 | ✅ done |
| Unit: numbering | node --test | `src/lib/__tests__/numbering-concurrency.test.mts` | P4-U-021 | ✅ done |
| Unit: exports & validation | node --test | `src/lib/__tests__/csv.test.mts`, `input-schemas.test.mts` | P4-U-022…023 | ✅ done |
| Database & isolation | node --test (`test:db`, URL-gated) | `src/lib/__tests__/tenant-isolation-db.test.db.mts`, `rls.test.mts` | P4-D-001…006 | ✅ done |
| Auth matrix generator + drift | node script + CI | `tests/scripts/gen-auth-matrix.mjs` | P4-A-001 | ✅ done |
| Auth matrix: API routes × personas | playwright (HTTP) | `tests/e2e/auth-matrix.spec.ts` | P4-A-002 | ✅ done |
| Auth matrix: server actions × personas | node --test (stubbed sessions) | `src/lib/__tests__/auth-matrix.test.mts` | P4-A-003 | ✅ done |
| E2E: anonymous visitor | playwright × 3 devices | `tests/e2e/anonymous.spec.ts` | P4-E-001…012 | ✅ done |
| E2E: consumer | playwright × 3 devices | `tests/e2e/consumer.spec.ts` | P4-E-020…040 | ✅ done |
| E2E: business owner | playwright × 3 devices | `tests/e2e/owner.spec.ts` | P4-E-050…120 | ✅ done |
| E2E: team members | playwright × 3 devices | `tests/e2e/team.spec.ts` | P4-E-130…138 | ✅ done |
| Attacker suite | node --test + playwright | `src/lib/__tests__/attacker-gaps.test.mts`, `tests/e2e/attacker.spec.ts` (+ existing: injection, redirect, webhook, rate-limit, upload, copilot-injection) | P4-X-001…011 | ✅ done |
| Bilingual fr-CA | playwright × 3 devices | `tests/e2e/bilingual.spec.ts` | P4-B-001…012 | ✅ done |
| Accessibility | playwright + axe | `tests/e2e/a11y.spec.ts` | P4-AX-001…010 | ✅ done |
| Performance & resilience | playwright + CI workflow | `tests/e2e/perf.spec.ts`, `.github/workflows/perf.yml` | P4-P-001…003 | ✅ done |

## Running

```bash
npm test            # unit + integration (1268 tests; DB-gated files excluded)
npm run test:db     # DB-gated tests only; FAILS if TEST_DATABASE_URL is unset
npx playwright test # E2E (1359 listed; needs seeded test DB + next start on :3100)
```

E2E never touches production: `playwright.config.ts` refuses any `vercel.app` baseURL,
and `tests/scripts/seed-e2e.mjs` refuses non-test database hosts.
