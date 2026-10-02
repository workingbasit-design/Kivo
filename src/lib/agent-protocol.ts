/**
 * EveryJob Agent Protocol v1 — a machine-readable contract that lets a
 * customer's AI assistant propose actions inside EveryJob safely.
 *
 * The core rule, stated once: AGENTS MAY PROPOSE, HUMANS DISPOSE.
 * Every write action creates a *pending* proposal. Nothing reaches a
 * business until the human approves via the unguessable confirmation link
 * (/a/[confirmToken], 24h expiry). The pattern follows the same shape many
 * AI assistants already use for consequential actions: propose first,
 * execute only on explicit human approval. (Product names in examples are
 * illustrative only and do not imply any official integration.)
 *
 * Identity model: a logged-in customer generates a scoped agent key in
 * their profile ("Connect your AI assistant") and pastes it into their
 * assistant. The key resolves the customer's identity server-side — name,
 * phone, email, city come from the account, never from re-typed fields.
 * Assistants without a key may still propose, but must supply a contact
 * email, and every proposal still needs the human's confirmation.
 *
 * Pure helpers in this file run under plain node:test (explicit `.ts`
 * extensions on relative imports, per repo convention).
 */
import { randomBytes, createHash } from 'node:crypto';
import { z } from 'zod';
import { validatePhone } from './phone.ts';

export const AGENT_PROTOCOL_VERSION = '1.0';

/** Customer-scoped agent keys look like `ejc_agent_<43 base64url chars>`. */
export const AGENT_KEY_PREFIX = 'ejc_agent_';
const AGENT_KEY_SECRET_BYTES = 32;

export type AgentScope = 'read' | 'write'; // read = directory search; write = propose actions

/** SHA-256 hex of the full key — the only thing ever stored. Pure. */
export function hashAgentKey(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex');
}

/** Generate a new customer agent key. Pure — returns plaintext once. */
export function generateAgentKey(): { key: string; keyHash: string; keyPrefix: string } {
  const key = `${AGENT_KEY_PREFIX}${randomBytes(AGENT_KEY_SECRET_BYTES).toString('base64url')}`;
  // Prefix shown in the UI comes from the RANDOM part, so every key is
  // distinguishable (the literal "ejc_agent_" prefix is identical for all).
  const keyPrefix = key.slice(AGENT_KEY_PREFIX.length, AGENT_KEY_PREFIX.length + 8);
  return { key, keyHash: hashAgentKey(key), keyPrefix };
}

/** Parse a stored comma-separated scope string. Defaults to read-only. Pure. */
export function parseAgentScopes(raw: string): AgentScope[] {
  const out: AgentScope[] = [];
  for (const s of raw.split(',').map((x) => x.trim().toLowerCase())) {
    if ((s === 'read' || s === 'write') && !out.includes(s)) out.push(s);
  }
  return out.length ? out : ['read'];
}

/** `write` implies `read`; `read` never implies `write`. Pure. */
export function keyHasScope(scopes: AgentScope[], need: AgentScope): boolean {
  if (need === 'write') return scopes.includes('write');
  return scopes.includes('read') || scopes.includes('write');
}

/** Unguessable capability token for /a/[token] confirmation links. Pure. */
export function generateConfirmToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Proposals live 24 hours, then expire and are purged. Pure. */
export function proposalExpiry(from: Date = new Date()): Date {
  return new Date(from.getTime() + 24 * 60 * 60 * 1000);
}

/** Pure expiry check (lets callers pass "now" in tests). */
export function isProposalExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

/** Header agents must send on POST /proposals so retries never double-create. */
export const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/** Proposal statuses. */
export const PROPOSAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  DECLINED: 'declined',
  EXPIRED: 'expired',
} as const;

/** Rate limits for the public agent surface (per client IP, advisory — see rate-limit.ts). */
export const AGENT_SEARCH_LIMIT = { limit: 60, windowMs: 60 * 1000 }; // 60 searches/min/IP
export const AGENT_PROPOSAL_LIMIT = { limit: 5, windowMs: 60 * 60 * 1000 }; // 5 proposals/hour/IP (spam-prone)

/** A label the assistant gives itself, e.g. "my assistant". Pure. */
export function normalizeAgentName(raw: unknown): string {
  const s = String(raw ?? '').trim().slice(0, 60);
  return s || 'AI assistant';
}

/**
 * Privacy gate for agent-facing contact details. A business that hid its
 * number on the booking page (showPhone = false) must not have it — or the
 * WhatsApp number, which routes to the same line — exposed to callers.
 * Pure: both agent search and the pro-detail route share this gate so a
 * future change cannot fix one route and leak through the other.
 */
export function gateAgentContact(
  showPhone: boolean,
  phone: string | null,
  whatsappNumber: string | null
): { phone: string | null; whatsapp: string | null } {
  return {
    phone: showPhone ? phone : null,
    whatsapp: showPhone ? whatsappNumber : null,
  };
}

/** Directory search query validation. Pure. */
export const agentSearchSchema = z.object({
  service: z.string().trim().max(80).optional().default(''),
  city: z.string().trim().max(80).optional().default(''),
  limit: z.coerce.number().int().min(1).max(25).optional().default(10),
});

/**
 * Proposal body validation. Pure.
 * - Exactly one of businessSlug / businessId must identify the pro.
 * - Authenticated callers (agent key) need no contact fields: identity
 *   comes from the key. Anonymous callers must supply customerEmail.
 */
export const agentProposalSchema = z
  .object({
    agentName: z.string().trim().max(60).optional().default(''),
    businessSlug: z.string().trim().min(1).max(120).optional(),
    businessId: z.string().trim().min(1).max(64).optional(),
    customerName: z.string().trim().max(120).optional().default(''),
    customerPhone: z.string().trim().max(32).optional().default(''),
    customerEmail: z.string().trim().max(160).optional().default(''),
    service: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(2000),
    city: z.string().trim().max(80).optional().default(''),
  })
  .superRefine((v, ctx) => {
    if (!v.businessSlug && !v.businessId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide businessSlug or businessId.',
        path: ['businessSlug'],
      });
    }
    if (v.customerEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.customerEmail)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid email address.', path: ['customerEmail'] });
    }
    if (v.customerPhone && !validatePhone(v.customerPhone).ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid phone number.', path: ['customerPhone'] });
    }
  });

export type AgentProposalInput = z.infer<typeof agentProposalSchema>;

/**
 * Build the machine-readable capability manifest served at
 * /.well-known/everyjob.json — how agents discover what they can do.
 * Pure: pass the request origin as baseUrl.
 */
export function buildAgentManifest(baseUrl: string) {
  const b = baseUrl.replace(/\/$/, '');
  return {
    protocol: 'everyjob-agent',
    version: AGENT_PROTOCOL_VERSION,
    description:
      'EveryJob welcomes AI agents. Agents may search the directory and propose quote requests on behalf of a customer. Every consequential action requires the human\'s one-tap confirmation — nothing executes until approved.',
    policy: `${b}/agents`,
    authentication: {
      type: 'optional-bearer',
      header: `Authorization: Bearer ${AGENT_KEY_PREFIX}...`,
      note: 'Customers generate a scoped key in their EveryJob profile ("Connect your AI assistant") and paste it into their agent. Authenticated calls act as the key owner: name, phone, email and city are resolved from the account. Anonymous agents may still propose but must supply customerEmail.',
    },
    confirmation: {
      required: true,
      mechanism: 'POST /api/agent/v1/proposals returns a confirmationUrl. The human opens it and taps Approve or Decline. Proposals expire after 24 hours.',
      guarantee: 'No quote request, lead, or message is created — and no business is contacted — until the human approves.',
    },
    idempotency: `POST /api/agent/v1/proposals requires the ${IDEMPOTENCY_HEADER} header. Retries with the same key return the original proposal instead of creating a duplicate.`,
    endpoints: [
      {
        method: 'GET',
        path: '/api/agent/v1/search?service=&city=&limit=',
        description: 'Search verified directory pros by service keyword and city. Public, rate-limited.',
      },
      {
        method: 'GET',
        path: '/api/agent/v1/pros/{slug}',
        description: 'Public pro profile: services, prices, hours, rating, service area. Public, rate-limited.',
      },
      {
        method: 'POST',
        path: '/api/agent/v1/proposals',
        description: 'Propose a quote request. Creates a PENDING proposal and returns its confirmationUrl. Requires Idempotency-Key header.',
      },
      {
        method: 'GET',
        path: '/api/agent/v1/proposals/{id}?token=',
        description: 'Check a proposal\'s status (pending/approved/declined/expired). The token is returned at proposal creation.',
      },
    ],
    rateLimits: {
      search: '60 requests/minute per IP',
      proposals: '5 proposals/hour per IP',
    },
    skills: [
      {
        name: 'everyjob-find-pro',
        description: 'Find a verified home-service pro: search the directory by service and city, read pro profiles.',
        url: `${b}/skills/everyjob-find-pro/SKILL.md`,
      },
      {
        name: 'everyjob-request-quote',
        description: "Propose a quote request to a pro on the customer's behalf. Creates a pending proposal; the human approves.",
        url: `${b}/skills/everyjob-request-quote/SKILL.md`,
      },
      {
        name: 'everyjob-track-proposal',
        description: 'Check a proposal\u2019s status: pending, approved, declined, or expired.',
        url: `${b}/skills/everyjob-track-proposal/SKILL.md`,
      },
      {
        name: 'everyjob-connect-assistant',
        description: "Connect a customer's AI assistant to their EveryJob account with a scoped agent key.",
        url: `${b}/skills/everyjob-connect-assistant/SKILL.md`,
      },
    ],
    rules: [
      'Identify your agent with a descriptive User-Agent and the agentName field.',
      'Never scrape HTML to perform actions — use this API.',
      'Respect rate limits; back off on 429.',
      'Consequential actions ALWAYS need human confirmation — do not attempt to bypass it.',
      'EveryJob never holds customer funds; agents must never request or handle payments.',
    ],
  };
}
