# Runbook — Rollback

## When to roll back

A deploy introduced errors (5xx spike, error boundary on key pages, broken writes) and the cause isn't a 2-minute fix.

## Option A: Vercel instant rollback (fastest)

1. Vercel Dashboard → Deployments.
2. Find the last known-good deployment → ⋯ → **Promote to Production**.
3. Verify `/api/health` and one login.

## Option B: Git revert + push (keeps history clean)

1. `git revert <bad-commit-sha>` (or `git revert HEAD` for the latest).
2. Push via the release script (`~/workspace/exact_push.py`) — Vercel auto-deploys the revert.
3. Verify as above.

## Database migrations

Rolling back code does **not** roll back the database. If the bad deploy included a migration:
- Additive migrations (new table/column): old code generally still runs — safe to roll code back first.
- Destructive migrations (drop/rename): do **not** roll back code blindly; assess whether the old code tolerates the new schema, or restore from backup (`backups.md`).

Rule: prefer additive migrations; never rename/drop a column in the same deploy that stops using it.
