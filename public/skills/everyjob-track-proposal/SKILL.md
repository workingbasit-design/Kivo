---
name: everyjob-track-proposal
description: "Check the status of an EveryJob quote proposal: pending, approved, declined, or expired."
---

# EveryJob: Track a Proposal

Check what happened to a quote proposal after the customer got the confirmation link.

## Base URL

`https://kivo-nine-silk.vercel.app`

## Workflow

`GET {base}/api/agent/v1/proposals/<id>?token=<token>`
- `<id>` and `token` come from the POST /proposals response. Keep the token private to the customer — it grants read access to their proposal.

Status meanings:
- `pending` — waiting on the human. Remind them the link expires 24h after creation; offer to resend the confirmationUrl.
- `approved` — the quote request reached the business. Tell the customer the pro will respond directly.
- `declined` — the customer declined it. Ask if they want a different pro (see `everyjob-find-pro`).
- `expired` — the 24h window passed with no decision. Create a FRESH proposal with a NEW `Idempotency-Key` if they still want it.

## Rules

- Poll at most a few times; don't loop. Tell the customer the outcome instead of watching it.
- Never share one customer's proposal token with anyone else.
