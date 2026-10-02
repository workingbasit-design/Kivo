# EveryJob — Hosting Plan

## Current setup (launch)

| Component | Provider / plan | Monthly cost |
|---|---|---|
| App hosting + CDN + cron | Vercel Hobby | $0 |
| Postgres | Prisma Postgres free (`kivo-db`) | $0 |
| File storage | Vercel Blob | $0 (currently broken in prod — cause unknown) |
| Email | Resend free tier | $0 |
| WhatsApp | Meta Cloud API free tier | $0 |
| Push | Web Push (VAPID, self-hosted keys) | $0 |
| OAuth / APIs | Google (Reviews, Calendar) | $0 |
| AI copilot | Anthropic API (optional; rule-engine fallback) | $0 unless key configured |
| DNS / domain | None — user owns no domain; Vercel subdomain | $0 |
| **Total** | | **$0** |

Region: default Vercel region; users are Canada-only (a `iad1`/Toronto-adjacent region would be ideal once traffic warrants attention).

## At 10x (hundreds of businesses, thousands of requests/day)

| Change | Why | Est. cost |
|---|---|---|
| Prisma Postgres paid tier | Free-tier connection cap is the first bottleneck (bursts already exhaust it; `connection_limit=1` + retries only go so far) | ~$20–30/mo |
| Vercel Pro (if needed) | Higher bandwidth/function limits | ~$20/mo |
| Fix or replace Blob | Attachments must work; evaluate R2/S3 if Blob pricing bites | $0–5/mo |

Nothing architectural changes at 10x: the modular monolith, tenant guard, and cron model all hold. Add a **staging project** before paid traffic.

## At 100x

- Read replicas / connection pooling (PgBouncer) for Postgres.
- Move cron + webhook delivery to a durable queue (Inngest/Trigger.dev).
- Revisit per-tenant rate limits and cache strategy (see `caching.md`).

## TODO (owner)

- [ ] **No staging environment** — production is the only deploy target today.
- [ ] **No billing alerts** — set spend alerts on Vercel and every provider before paid tiers.
- [ ] Fix Vercel Blob uploads (prod error unknown) or migrate storage.
