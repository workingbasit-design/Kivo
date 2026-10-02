# EveryJob — Monitoring Plan

Status: minimal but real. Health endpoints exist; alerting is not yet wired (TODO below).

## Uptime checks (TODO: wire to an external checker)

| Check | URL | Expect |
|---|---|---|
| Homepage | `/` | 200 |
| Login | `/login` | 200 |
| Deep health | `/api/health` | 200 + `{status:"ok", db:"ok"}` (503 + `degraded` when DB unreachable) |
| Liveness | `/api/health/live` | 200 (cheap — for load balancers) |
| Core flow | `/api/agent/v1/search?service=plumber&city=Toronto` | 200 JSON |

## Technical metrics

- Error rate (5xx) per route — via Vercel logs today; error tracker TODO (book layer 13)
- p95 latency per endpoint — Vercel Analytics/speed insights if enabled
- Database connections — watch for `too many connections for role "prisma_migration"` in logs (the known free-tier ceiling)
- Cron runs: `/api/cron/*` should fire on schedule (Vercel cron); check messaging/recurring/workflows/agent-purge executions
- Webhook delivery failures — logged by `emitWebhookEvent` retry sweep

## Business metrics

- Signups (business + customer), active businesses/week
- Quote requests created vs approved (agent protocol funnel)
- Payments recorded (count + volume), invoices sent
- Failed Stripe payments / disputes

## Alert rules (keep minimal — only things needing a human)

| Alert | Threshold | Severity | Action |
|---|---|---|---|
| `/api/health` 503 | 2 consecutive checks | High | See `runbooks/incident.md`; likely DB connection exhaustion → check logs, consider Postgres upgrade |
| 5xx spike | > 5% of requests over 10 min | High | Check Vercel logs; roll back if tied to a deploy (`runbooks/rollback.md`) |
| Cron missed | No successful run in 2x interval | Medium | Check Vercel cron config + `CRON_SECRET` |
| Stripe webhook failures | Any `failed` delivery burst | Medium | Check endpoint + signature secret |

## TODO (owner)

- [ ] Point an uptime checker (e.g. Better Stack free, UptimeRobot) at the checks above
- [ ] Add error tracking (Sentry free tier) — frontend + backend, with `businessId` attached
- [ ] Route alerts to email/Slack; link each alert to its runbook
