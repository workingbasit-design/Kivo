# Project: EveryJob

Canada-only field-service SaaS for 1–5-person home-service shops (plumbers, electricians, cleaners) + a consent-based homeowner directory. Free pro app; paid directory leads. Tagline: "Every job. One place."

## Stack (do not change without asking)
- Frontend: Next.js 15 (App Router) + TypeScript strict + Tailwind CSS v4
- Backend: Next.js Server Actions + API routes (modular monolith)
- Database: Prisma Postgres (Vercel), ORM: Prisma. Tenant guard: `src/lib/tenant-guard.ts` (fail-closed)
- Auth: custom sessions (business + customer) + Google OAuth (reviews/calendar)
- Hosting: Vercel (auto-deploy from GitHub main). Pushes via Git Data API (`~/workspace/exact_push.py`) — git-protocol scope is broken
- Money: CAD only. All tax paths share `calcTax`; `recordPayment` is transactional

## Rules
- Never commit secrets. All secrets go in environment variables, documented in `.env.example`.
- Every tenant-owned query MUST scope by `businessId` — the guard fails closed (`TenantScopeError`). Compound unique keys embedding `businessId` are exempt (see tenant-guard.ts).
- Money is recorded via payment records; marking a job PAID auto-settles via `settleJobPaid()` (same transaction).
- Every new API endpoint needs: input validation (zod), auth check, tenant-scope check, tests.
- Every database change goes through a Prisma migration. Never edit the DB by hand.
- Run `npx tsc --noEmit`, `npm test`, and `npm run build` before saying a task is done.
- Ask before adding a new dependency.
- Canada-only: no other regions, CAD only, EN + Canadian French (no other locales).
- QST 9.975% applies to the price EXCLUDING GST since 2013-01-01 — never "fix" this.
- Setup/onboarding must always offer "Do later" — never force completion.
- $0 spend: never incur costs; abort before anything asking for payment.

## Commands
- Dev: `npm run dev`
- Test: `npm test` (node --test with `src/lib/__tests__/register-loader.mjs`; source imports need explicit `.ts` extensions; stub `@/lib/prisma`, never the real client)
- Typecheck: `npx tsc --noEmit`
- Build: `npm run build`

## Architecture decisions
- Agent Protocol: agents may PROPOSE, humans DISPOSE. Pending proposals via `/api/agent/v1/proposals`, human confirms at `/a/[token]` (24h expiry). Skills in `public/skills/*/SKILL.md`, advertised in `/.well-known/everyjob.json`.
- Webhooks (Stripe etc.) are the source of truth; handlers idempotent via stored event IDs.
- DB resilience: `connection_limit=1`, `db-retry.ts` (pre-execution retries only — writes never double-apply).
- A DB outage must NEVER look like a logout (PortalNotice, not redirect).
