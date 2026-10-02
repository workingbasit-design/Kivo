# Runbook — Incident

## Declare

An incident = users can't do core work (sign in, jobs, invoices, payments) or data may be wrong. Declare in one line: **what's broken, since when, who's affected.**

## Respond

1. **Assess**: `/api/health` (DB?), Vercel Deployments (bad deploy?), Vercel logs (error spike?).
2. **Mitigate first**: if tied to a deploy → roll back (`rollback.md`). If DB connections exhausted → check for runaway cron/instances; the free-tier cap is the usual suspect.
3. **Communicate**: users see in-app notices for degraded states; there is no public status page yet (TODO). For a prolonged outage, pin a notice via the portal notice mechanism.
4. **Fix forward** only when the cause is understood and the fix is small and safe.

## Post-incident review (template)

```markdown
## Incident: <title>
- Date/time (local): 
- Duration: 
- Impact: (who, what couldn't they do)
- Root cause: 
- Mitigation: 
- Fix: (commit/link)
- Follow-ups:
  - [ ] test that would have caught it
  - [ ] monitor/alert that would have paged
  - [ ] doc update
```

File completed reviews under `docs/runbooks/incidents/` (create the folder on first use).
