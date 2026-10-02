---
name: everyjob-request-quote
description: "Propose a quote request to an EveryJob pro on the customer's behalf. Creates a pending proposal; the human approves."
---

# EveryJob: Request a Quote

File a quote request with a pro the customer chose. This CREATES A PENDING PROPOSAL ONLY — nothing reaches the business until the human taps Approve on the confirmation link. Agents may propose; humans dispose.

## Base URL

`https://kivo-nine-silk.vercel.app`

## Prerequisites

- The customer has picked a pro (see `everyjob-find-pro`). Never pick for them silently.
- Customer identity: if you hold an EveryJob agent key (`ejc_agent_...`), send `Authorization: Bearer <key>` and OMIT customer contact fields — the server resolves name/phone/email/city from the account. Without a key, `customerName` and `customerEmail` are required.

## Workflow

1. POST `{base}/api/agent/v1/proposals` with headers:
   - `Content-Type: application/json`
   - `Authorization: Bearer <key>` (if you have one)
   - `Idempotency-Key: <unique-per-request>` (REQUIRED — retries with the same key return the original proposal, never a duplicate)
   
   Body:
   ```json
   {
     "agentName": "your assistant name",
     "businessSlug": "<slug from search>",
     "service": "Leaky kitchen faucet repair",
     "description": "Kitchen faucet drips constantly; likely cartridge. Ground floor, parking available.",
     "city": "Toronto"
   }
   ```
   - Exactly one of `businessSlug` / `businessId` is required.
   - `description`: be specific — what, where, access notes. Max 2000 chars.
2. The response (201) contains `confirmationUrl` and an `expiresAt` (24h). 
3. Share the `confirmationUrl` with the customer and tell them: the request goes to the business ONLY after they open it and tap Approve. Offer the pro's booking page as the no-wait alternative.

## Rules

- Rate limit: 5 proposals/hour per IP. This endpoint is spam-prone — never retry-loop it.
- A 410 `idempotency_key_retired` means that key was already used for a finished proposal — generate a NEW key, don't reuse.
- Never claim the request was sent. It is PENDING until the human approves.
- EveryJob never holds customer funds; never request or handle payments.
- Canada-only, CAD only, English or Canadian French.
