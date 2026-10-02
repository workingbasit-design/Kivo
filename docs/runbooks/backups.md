# Runbook — Backups

## Setup

Prisma Postgres (managed by Vercel) takes automated backups of `kivo-db`. Retention follows the plan's policy — confirm current retention in Vercel Dashboard → Storage → `kivo-db` → Backups.

## Point-in-time restore

1. Vercel Dashboard → Storage → `kivo-db` → Backups.
2. Pick the restore point **before** the data-loss event.
3. Restore **into a separate database/branch first** if possible; verify the data, then promote — never restore blindly over production.
4. After restore: run `GET /api/health`, sign in, and spot-check jobs/invoices/payments.

## ⚠️ Never tested

A restore has **never been performed** — not even to a scratch database. The book's rule: you don't have backups until you've restored one. TODO (owner): schedule a restore drill to a throwaway branch and record the result here.

## What gets deleted when

- Deleting a business cascades per Prisma relations; there is no soft-delete. Treat deletes as permanent.
- `unsafeUnscoped` agent-proposal purges (`/api/cron/agent-purge`) hard-delete expired proposals after 24h.
