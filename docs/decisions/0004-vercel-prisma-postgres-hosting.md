# 0004 — Vercel + Prisma Postgres hosting

Date: 2026-09-26

## Context

Solo founder, $0 budget, Canada-only user base. Needed: zero-ops hosting with preview-quality DX, a managed Postgres, and push-button deploys — without learning infrastructure.

## Decision

**Vercel Hobby + Prisma Postgres (free tier)**, auto-deploying from GitHub `main`. Git-protocol pushes are broken for the stored credential, so releases go through the GitHub Git Data API (`exact_push.py`, byte-exact tree verification). Env vars in Vercel project settings (Production scope); a redeploy is required for env changes to take effect.

## Alternatives considered

- **Supabase / Neon + separate host**: more generous free Postgres, but adds a second dashboard and connection-string juggling; rejected for simplicity.
- **Railway / Render / Fly.io**: fine platforms, but Vercel's Next.js integration (ISR, image optimization, cron) is the path of least resistance for this stack.
- **Kubernetes / Terraform**: absurd at this stage; rejected outright.

## Consequences

- Positive: $0/month; deploys are `git push` (via the API script); managed backups exist.
- Negative: Prisma Postgres free tier has a tiny per-role connection cap — defended in depth (`connection_limit=1`, cached client, `db-retry` on init failures only, never on writes). No staging environment: production is the only target, so every push is a production deploy. Vercel Blob (attachments) is currently broken in prod with unknown cause. First paid upgrade when needed: Postgres scale for connections, then a staging project.
