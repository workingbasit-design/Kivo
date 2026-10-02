# 0003 — Agent Protocol: propose, don't execute

Date: 2026-09-30

## Context

The user asked for an EveryJob that works the way Meta Muse / OpenAI bots do: the customer's AI assistant already knows the customer, finds the right technician, and books — automatically, securely, with scoped authority. The dangerous version is an agent that silently takes consequential actions (contacting businesses, creating records) on a user's behalf.

## Decision

**Agents may propose; humans dispose.** The Agent Protocol v1 (`src/lib/agent-protocol.ts`):
- Machine-readable manifest at `/.well-known/everyjob.json` + public skills (`public/skills/*/SKILL.md`) so any assistant can discover capabilities.
- Identity via scoped customer agent keys (`ejc_agent_…`, SHA-256 hashed at rest, read/write scopes, revocable); identity resolves server-side from the account, never from re-typed fields.
- `POST /api/agent/v1/proposals` creates a **PENDING** proposal only — mandatory `Idempotency-Key` (retries dedupe; retired keys 410), business re-validated server-side (hidden/unverified/non-consenting fail closed), rate-limited (5/hour/IP).
- The human approves at `/a/[token]` (unguessable token, 24h expiry, exact preview). Approval runs one atomic transaction: re-checks pending+unexpired (first commit wins), then creates the quote request + lead draft. Guest emails matching an existing account force login first.
- Phone numbers are privacy-gated (`gateAgentContact`): a business that hid its number never leaks it through search or pro profiles.
- The in-app concierge ("Get it done for me") follows the same shape: exact preview, explicit send, idempotent.

## Alternatives considered

- **Direct execution with an "undo"**: rejected — contacting a real business can't be un-sent; the cost of a wrong autonomous action exceeds the friction of one tap.
- **Requiring login before any proposal**: rejected — raises the barrier for assistant-driven discovery; the confirm-link + claim-account flow preserves security without it.

## Consequences

- Positive: full automation of *finding and preparing* the booking, zero autonomous *consequential* actions; every write is attributable (agentName, key id) and expirable.
- Negative: one human tap per request — by design. Anonymous proposals need an email, which slightly weakens attribution (mitigated by the login-forcing identity gate).
