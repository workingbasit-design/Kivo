# Kivo — Deployment Guide

Production deployment for the Kivo app (Next.js 16.3.5, React 19, Prisma 5.22,
SQLite in dev → **Postgres in production**). No new code changes are needed to
deploy — only configuration.

> **Golden rule: do not deploy on SQLite.** SQLite is a single-file database
> with no concurrent-write story and no managed backups. Migrate to Postgres
> first (Section 3).

---

## 1. Hosting options (trade-offs — pick what fits)

### Vercel (managed Next.js)
- **Pros:** zero-config Next.js deploys, preview URLs per PR, global CDN, free
  tier generous. `npx prisma generate` runs automatically if added to the build
  command.
- **Cons:** **serverless functions = many instances.** Kivo's rate limiter
  (`src/lib/rate-limit.ts`) and recurring-job mutex (`src/lib/recurring.ts`)
  are **in-process memory** — on Vercel each invocation may be a different
  instance, so rate limits become per-instance (weaker) and the recurring
  mutex degrades to the DB `@@unique` backstop only (still duplicate-safe, but
  expect occasional unique-constraint retries in logs). Long builds on the
  free tier can time out.
- **Verdict:** fine for launch/low traffic; plan to move if you scale past one
  region or need strict rate limiting.

### Railway (container PaaS)
- **Pros:** one container = one Node process, so the in-memory rate limiter
  and mutex work exactly as tested. Managed Postgres add-on in one click.
  Simple `railway up` deploys, persistent volumes available.
- **Cons:** costs money from day one (no real free tier); smaller ecosystem
  than Vercel.
- **Verdict:** the closest to "dev server, but production". Good default for
  a small-business SaaS.

### Fly.io (containers near users)
- **Pros:** runs a real VM/container (single process semantics preserved),
  regions in India (Mumbai `bom`) and Canada (Toronto `yyz`) for low latency,
  managed Postgres (or bring Neon/Supabase). Cheap.
- **Cons:** more DIY than Railway (Dockerfile/fly.toml, `flyctl` CLI);
  Postgres is self-managed-ish.
- **Verdict:** best latency story for IN + CA users; slightly more ops work.

### VPS (Hetzner / DigitalOcean / any VM)
- **Pros:** cheapest at steady state, full control, single Node process,
  SQLite→Postgres on the same box if you want. Great for India pricing.
- **Cons:** you own everything — OS patches, TLS certs, Postgres backups,
  process supervision (systemd/PM2), firewall.
- **Verdict:** maximum control and lowest cost; only if you're comfortable
  being your own ops team.

**Recommendation on process model:** whatever you pick, run **exactly one**
app instance to start. Kivo was designed, tested, and verified as a single
Node process (79/79 QA). Scale horizontally only after moving rate-limit and
recurring-mutex state to Redis/shared storage.

---

## 2. Environment variables (complete list)

Every `process.env` reference in `src/` is documented here. Set these in your
host's environment/secrets manager — never commit them to git.

| Variable | Required | What it does |
|---|---|---|
| `DATABASE_URL` | **Yes (prod)** | Postgres connection string, e.g. `postgresql://kivo:PASSWORD@host:5432/kivo?schema=public`. Not needed in dev (SQLite file). |
| `NODE_ENV` | Set by host | Must be `production` in prod. Enables the `Secure` flag on the session cookie (`src/lib/auth.ts`). |
| `ANTHROPIC_API_KEY` | No | Enables Claude-powered copilot replies. **Without it the copilot uses the built-in rule-based engine** (fully functional, tested). Only set if you want the AI upgrade. |
| `ANTHROPIC_MODEL` | No | Model for the copilot when the key is set. Default: `claude-sonnet-4-20250514`. |
| `KIVO_ADMIN_EMAILS` | No | Comma-separated admin emails, e.g. `you@example.com,ops@example.com`. Gates the `/directory-reports` moderation queue. Without it, that page shows "Not authorized" for everyone. |
| `PORT` | No | Port for `npm start`. Default `3000`. |

Notes:
- **No session-signing secret exists.** Sessions are opaque random IDs stored
  in the `Session` table; the `kivo_session` cookie holds only the ID
  (`httpOnly`, `SameSite=lax`, `Secure` in production). There is no
  `NEXTAUTH_SECRET`-style variable to set.
- **No payment keys exist by design.** Kivo never processes money; UPI/payment
  details are display text only.
- Share links (`/q/[token]`, `/i/[token]`) and OG tags use relative/app URLs —
  no `APP_URL` variable is required by the code. If you put the app behind a
  proxy under a different public host, the CSRF helper (`src/lib/csrf.ts`)
  compares against the request's own `Host`/`X-Forwarded-Host`, which works
  through standard proxies.

---

## 3. SQLite → Postgres migration (exact steps)

The dev database is SQLite (`prisma/schema.prisma`: `provider = "sqlite"`).
The repo has **no `prisma/migrations` directory** (dev used `prisma db push`),
so generate a proper baseline migration before production:

```bash
# 1. Provision Postgres (Neon, Supabase, Railway, RDS — your choice)

# 2. Point a STAGING copy of the repo at it and generate the baseline migration
export DATABASE_URL="postgresql://kivo:PASSWORD@staging-host:5432/kivo"
# temporarily switch provider in prisma/schema.prisma:
#   datasource db { provider = "postgresql"  url = env("DATABASE_URL") }
npx prisma migrate dev --name init
# this creates prisma/migrations/<timestamp>_init/ and applies it

# 3. Commit the prisma/migrations directory to git

# 4. On the production host, apply (never use `migrate dev` in prod):
export DATABASE_URL="postgresql://kivo:PASSWORD@prod-host:5432/kivo"
npx prisma migrate deploy
npx prisma generate
```

**Data migration:** the dev SQLite DB ships empty (0 rows in all tables, by
design — test data is wiped after every QA run). A fresh production deploy
starts empty, so **no data copy is needed**. If you ever need to move a
SQLite DB's data to Postgres later:

```bash
# dump each table to CSV from sqlite, then \copy into Postgres,
# or use pgloader:
pgloader sqlite:///path/to/dev.db postgresql://kivo:PASSWORD@host:5432/kivo
```

**Postgres-specific notes (verified against the schema):**
- `Job.idempotencyKey @unique` — Postgres treats multiple NULLs as distinct,
  same as SQLite. No behavior change.
- `@@unique([recurringJobId, date])` on `Job` — enforced identically.
- `DirectoryReport.status` enum-like string field — fine.
- `Business.workingHours` is a JSON string column — fine on Postgres
  (consider `Json` type in a future migration; not required).

---

## 4. Secrets handling

1. Generate nothing in advance — Postgres providers give you the
   `DATABASE_URL`; that's the only true secret at launch.
2. Store secrets in the host's secret manager (Vercel Environment Variables,
   Railway Variables, Fly `fly secrets set`, or a `.env` file with `0600`
   permissions on a VPS — never in git, never in chat logs).
3. `ANTHROPIC_API_KEY` is optional; add it later without a redeploy on most
   hosts (env change → restart).
4. Rotate `DATABASE_URL` credentials from your Postgres provider's dashboard;
   the app picks up the new value on restart (no code change).
5. The repo must never contain `.env`, `*.pem`, or credential files. The
   dev `.env` (if any) stays local-only.

---

## 5. Build & start commands

```bash
# reproducible install (uses package-lock.json)
npm ci

# generate the Prisma client (needs network for engines on first run;
# behind a restricted egress set PRISMA_ENGINES_MIRROR as in dev)
npx prisma generate

# production build
npm run build

# apply pending migrations (Postgres only)
npx prisma migrate deploy

# start (PORT defaults to 3000)
npm start
```

Suggested host build command (single line):
```bash
npm ci && npx prisma generate && npx prisma migrate deploy && npm run build
```
Start command: `npm start`.

---

## 6. Health checks — what "healthy" looks like

There is no dedicated `/api/health` route. Verify health with:

```bash
# 1. App responds
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR-DOMAIN/login
# expect: 200

# 2. Database is reachable (register a test business via the UI, then delete it;
#    a broken DATABASE_URL surfaces as a 500 on any data page)

# 3. Public pages work unauthenticated (proves proxy.ts + DB read path)
curl -s -o /dev/null -w "%{http_code}\n" https://YOUR-DOMAIN/directory
# expect: 200
```

**Healthy =** `/login` returns 200, you can register/log in, the dashboard
loads with real data, `/directory` renders publicly, and share-token links
(`/q/[token]`) resolve. **Unhealthy =** any 500 on data pages (usually
`DATABASE_URL` wrong/unreachable or migrations not applied — check
`npx prisma migrate status`).

Recommended: add a tiny `src/app/api/health/route.ts` returning
`{ ok: true }` after a `prisma.$queryRaw\`SELECT 1\`` — useful for
load-balancer/uptime checks. (Not required for launch.)

---

## 7. Backup strategy

**Database (the important one):**
- Use your Postgres provider's automated backups + point-in-time recovery
  (Neon/Supabase/RDS all offer this — enable it on day one, verify a restore
  to a scratch DB once).
- Additionally, a nightly logical dump off-site:
  ```bash
  pg_dump "$DATABASE_URL" --format=custom --file="/backups/kivo-$(date +%F).dump"
  ```
  Keep 30 days. Test-restore monthly.

**App-level (per business, already built in):**
- Every business can export tenant-scoped CSVs from **Reports → Export**
  (customers, jobs, invoices, payments) and a full backup from **Settings**.
  Document this to users as their own data-portability story.

**Code/config:**
- Git repo is the backup. Tag releases: `git tag v1.0.0 && git push --tags`.

---

## 8. Rollback plan

1. **Bad deploy:** redeploy the previous known-good build (Vercel/Railway/Fly
   all keep prior releases one click away; on a VPS, keep the last two
   `.next` builds or use `git checkout <tag>` + rebuild). The app is
   stateless — old code + current DB is safe as long as migrations are
   compatible (see below).
2. **Bad migration:** Prisma migrations are forward-only. Never
   `migrate resolve --rolled-back` on production unless you fully understand
   the data loss. Prefer a **new forward migration** that undoes the change.
   Because v1.0.0's baseline migration is the only one at launch, rollback
   risk is minimal — just don't deploy code that depends on a migration you
   haven't applied.
3. **Data incident:** restore the Postgres PITR backup to a scratch database,
   verify, then promote. Never restore over the live DB without a fresh
   snapshot first.
4. **Keep a runbook note** of the last-good tag and the migration history
   (`npx prisma migrate status`) with each release.

---

## 9. Pre-flight (do once, before first deploy)

- [ ] `npx tsc --noEmit` clean, `npm run build` green (verified 2026-09-22)
- [ ] `prisma/migrations` baseline generated and committed
- [ ] `DATABASE_URL` set on the host; `npx prisma migrate deploy` succeeds
- [ ] `NODE_ENV=production`
- [ ] Decide on `ANTHROPIC_API_KEY` (optional) and `KIVO_ADMIN_EMAILS`
- [ ] Smoke test on the deployed URL: register → login → create
      customer/job/quote/invoice/payment → public booking page → directory
      search → share-token link opens publicly
- [ ] Backups enabled and one restore tested
- [ ] See `LAUNCH_CHECKLIST.md` for the full launch-day sequence
