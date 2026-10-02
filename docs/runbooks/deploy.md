# Runbook — Deploy

## How deploys work

1. Changes are committed to GitHub `main` (`workingbasit-design/Kivo`).
2. Vercel auto-deploys `main` — every push is a **production** deploy. There is no staging.
3. Git-protocol pushes are broken for the stored credential; releases go through the GitHub Git Data API via `~/workspace/exact_push.py` (verifies the remote tree is byte-identical to local HEAD).

## First deploy / redeploy checklist

- [ ] `DATABASE_URL` set in Vercel (Production)
- [ ] `APP_BASE_URL` = production URL
- [ ] `CRON_SECRET`, `MESSAGING_ENC_KEY` set (generate: `openssl rand -base64 32`)
- [ ] Stripe keys (test first), `STRIPE_WEBHOOK_SECRET` matches the webhook endpoint
- [ ] `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` set (see Google Cloud OAuth client)
- [ ] VAPID keys for push, `RESEND_API_KEY` for email (optional)
- [ ] Prisma migrations applied: `npx prisma migrate deploy` (runs as part of build)

## Environment variables

Set in Vercel Dashboard → Project → Settings → Environment Variables (Production scope). **Changing a variable requires a redeploy to take effect** — use Deployments → ⋯ → Redeploy, or push any commit.

## Verifying a deploy

1. Vercel Dashboard → Deployments → status Ready.
2. `GET /api/health/live` → 200; `GET /api/health` → `{status:"ok",db:"ok"}`.
3. Spot-check `/login` → sign in → `/dashboard` loads with no error boundary.
