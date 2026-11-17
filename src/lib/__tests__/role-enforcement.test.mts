/**
 * B-8 — Role enforcement sweep.
 *
 * P4-A-003a proves every server action is *authenticated* (logged in).
 * B-8 proves the stronger property where it matters: the destructive and
 * money-moving functions are *role-gated* (OWNER/ADMIN, or OWNER-only for
 * Stripe Connect), not merely logged-in. A TECHNICIAN is logged in — and
 * must not be able to void an invoice, record a payment, delete a job, or
 * change business settings by invoking the action directly.
 *
 * B-8a (file level): every server action + API route is authenticated by
 * some mechanism (session, customer session, cron secret, API key, agent
 * key, webhook signature, share token) or is on an explicit public
 * allowlist. Any new unauthenticated surface fails this test.
 *
 * B-8b (function level): in the six highest-risk action files, every
 * exported function is classified (TIER_1 gated now, TIER_2 known gap for
 * the next wave, READ_ONLY, TOKEN_GATED, EXCLUDED). A new exported
 * function that appears in none of the lists fails the test, so a missing
 * role check is a failing test rather than a silent hole. Tier-1
 * functions must contain a role-aware call (requireCapability /
 * requireMembership / requireAdminRole / canRole) in their own body.
 *
 * B-8c: settleJobPaid() must NOT be an exported server action. It used to
 * be exported from src/app/actions/invoices.ts, where it took a raw
 * businessId + jobId with no session check — anyone able to invoke a
 * server action could mark any job PAID with matching ledger writes. It
 * now lives in src/lib/settle-job-paid.ts, reachable only from
 * already-authenticated server code (jobs.ts status transitions).
 */
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIONS_DIR = join(HERE, '..', '..', 'app', 'actions');
const API_DIR = join(HERE, '..', '..', 'app', 'api');
const LIB_DIR = join(HERE, '..');

/** Any of these counts as authentication for a file. */
const AUTH_CALLS =
  /requireCapability|requireMembership|requireAdminRole|requireAuth|getSession|getCustomerSession|requireCustomer|requireCronAuth|authenticateV1Request|authenticateAgentRequest|verifyWebhookSignature|verifyGoogleIdToken|resolveSignatureRequest|confirmToken|hub\.verify_token/;

/** API routes intentionally public (each documents why in its header). */
const PUBLIC_API_ALLOWLIST = new Set([
  'health/route.ts', // liveness probe
  'health/live/route.ts', // liveness probe
  'push/vapid-public-key/route.ts', // public VAPID key by design
  'places/search/route.ts', // deliberately unauthenticated: public booking page
  'agent/v1/search/route.ts', // public directory search, rate-limited
  'agent/v1/pros/[slug]/route.ts', // public pro profile, verified/opted-in only
  'auth/google/route.ts', // OAuth entry (redirect-based flow)
  'pay/invoice/route.ts', // 256-bit share token IS the authorization
  'pay/quote-deposit/route.ts', // 256-bit share token IS the authorization
  'track/[token]/ping/route.ts', // token in URL IS the authorization
]);

/** Server actions intentionally callable without a session. */
const PUBLIC_ACTION_ALLOWLIST = new Set([
  'booking-slots.ts', // public booking page
  'customer-auth.ts', // login/signup/logout
  'password-reset.ts', // request/reset (token-gated)
  'customer-password-reset.ts', // customer request/reset (token-gated)
]);

function walkRoutes(dir: string, out: string[]): void {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) walkRoutes(p, out);
    else if (e.name === 'route.ts' || e.name === 'route.tsx') out.push(p);
  }
}

describe('B-8a: every server action + API route is authenticated or allowlisted', () => {
  test('server actions', () => {
    const files = readdirSync(ACTIONS_DIR).filter((f) => f.endsWith('.ts'));
    assert.ok(files.length > 50, `expected 50+ action files, got ${files.length}`);
    const unauthenticated: string[] = [];
    for (const file of files) {
      const src = readFileSync(join(ACTIONS_DIR, file), 'utf8');
      if (!/^'use server'/m.test(src)) continue;
      if (!AUTH_CALLS.test(src) && !PUBLIC_ACTION_ALLOWLIST.has(file)) {
        unauthenticated.push(file);
      }
    }
    assert.deepEqual(unauthenticated, [], `unauthenticated server actions: ${unauthenticated.join(', ')}`);
  });

  test('API routes', () => {
    const routes: string[] = [];
    walkRoutes(API_DIR, routes);
    assert.ok(routes.length > 40, `expected 40+ API routes, got ${routes.length}`);
    const unauthenticated: string[] = [];
    for (const full of routes) {
      const rel = full.slice(API_DIR.length + 1);
      const src = readFileSync(full, 'utf8');
      if (!AUTH_CALLS.test(src) && !PUBLIC_API_ALLOWLIST.has(rel)) {
        unauthenticated.push(rel);
      }
    }
    assert.deepEqual(unauthenticated, [], `unauthenticated API routes: ${unauthenticated.join(', ')}`);
  });

  test('allowlists stay minimal', () => {
    assert.ok(PUBLIC_API_ALLOWLIST.size <= 12, 'public API allowlist is growing — review each addition');
    assert.ok(PUBLIC_ACTION_ALLOWLIST.size <= 5, 'public action allowlist is growing — review each addition');
  });
});

/** A role-aware call inside a function body (not just "logged in"). */
const ROLE_AWARE = /requireCapability|requireMembership|requireAdminRole|canRole/;

/** Tier 1: destructive / money functions — role-gated NOW, test enforces. */
const TIER_1: Record<string, string[]> = {
  'invoices.ts': ['deleteInvoice', 'voidInvoice', 'voidPayment', 'createCreditNote', 'recordPayment'],
  'jobs.ts': ['deleteJob'],
  'quotes.ts': ['deleteQuote', 'recordQuoteDeposit'],
  'customers.ts': ['deleteCustomer'],
  'settings.ts': [
    'updateBusinessSettings',
    'inviteTeamMember',
    'removeTeamMember',
    'suspendTeamMember',
    'unsuspendTeamMember',
    'changeTeamMemberRole',
    'completeBusinessSetup',
    'uploadBusinessLogo',
    'removeBusinessLogo',
  ],
  'stripe.ts': ['confirmLivePaymentsAction', 'disconnectStripeAction'],
};

/**
 * Tier 2: KNOWN GAPS for the next wave — mutating functions still
 * requireAuth-only. Listed so the gap is visible, not silent. Do NOT
 * close these by big-bang: several are called by legitimate technician
 * flows (e.g. updateJobStatus completes a technician's own job) and need
 * per-function caller analysis first (see B-8 follow-up).
 */
const TIER_2_KNOWN_GAPS: Record<string, string[]> = {
  'invoices.ts': [
    'createInvoice',
    'updateInvoiceStatus',
    'sendInvoiceEmail',
    'regenerateInvoiceShareLink',
    'revokeInvoiceShareLink',
    'setInvoiceShareLinkExpiry',
  ],
  'jobs.ts': ['createJob', 'updateJob', 'updateJobStatus', 'updateJobSchedule', 'addJobNote', 'deleteJobNote'],
  'quotes.ts': [
    'createQuote',
    'updateQuoteItems',
    'createQuoteTemplate',
    'updateQuoteTemplate',
    'deleteQuoteTemplate',
    'updateQuoteStatus',
    'updateQuoteExpiry',
    'sendQuoteEmail',
    'convertQuoteToJob',
    'createQuoteAddon',
    'updateQuoteAddon',
    'deleteQuoteAddon',
    'regenerateQuoteShareLink',
    'revokeQuoteShareLink',
    'setQuoteShareLinkExpiry',
  ],
  'customers.ts': ['createCustomer', 'updateCustomer', 'archiveCustomer', 'unarchiveCustomer', 'convertLeadToCustomer'],
  'settings.ts': [],
  'stripe.ts': ['setQuoteDepositAction', 'recordManualQuoteDepositAction'],
};

/** Read-only getters: no role gate needed (session auth suffices). */
const READ_ONLY: Record<string, string[]> = {
  'invoices.ts': ['getInvoiceShareState'],
  'jobs.ts': [],
  'quotes.ts': ['getQuoteShareState'],
  'customers.ts': [],
  'settings.ts': [],
  'stripe.ts': ['getStripeDashboard'],
};

/** Token-gated by design (the token, not the session, is the authority). */
const TOKEN_GATED: Record<string, string[]> = {
  'invoices.ts': [],
  'jobs.ts': [],
  'quotes.ts': ['portalQuoteDecisionByToken'],
  'customers.ts': [],
  'settings.ts': [],
  'stripe.ts': [],
};

/**
 * Excluded from gating: seedSampleJobs is the D6-gated demo seeder
 * (demo/non-production businesses only, release-coordinator owned) —
 * do not touch here.
 */
const EXCLUDED: Record<string, string[]> = {
  'invoices.ts': [],
  'jobs.ts': ['seedSampleJobs'],
  'quotes.ts': [],
  'customers.ts': [],
  'settings.ts': [],
  'stripe.ts': [],
};

function exportedFunctions(src: string): string[] {
  return [...src.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);
}

/** Source slice for one exported function: up to the next export (or EOF). */
function functionSlice(src: string, name: string): string {
  const start = src.search(new RegExp(`^export async function ${name}\\b`, 'm'));
  assert.ok(start !== -1, `function ${name} not found`);
  const rest = src.slice(start);
  const next = rest.slice(1).search(/^export async function /m);
  return next === -1 ? rest : rest.slice(0, next + 1);
}

describe('B-8b: Tier-1 destructive/money functions are role-gated', () => {
  for (const [file, fns] of Object.entries(TIER_1)) {
    const src = readFileSync(join(ACTIONS_DIR, file), 'utf8');
    for (const fn of fns) {
      test(`${file}::${fn} is role-gated`, () => {
        assert.ok(ROLE_AWARE.test(functionSlice(src, fn)), `${fn} has no role-aware call in its body`);
      });
    }
  }

  test('every export in the six high-risk files is classified', () => {
    for (const file of Object.keys(TIER_1)) {
      const src = readFileSync(join(ACTIONS_DIR, file), 'utf8');
      const classified = new Set([
        ...(TIER_1[file] ?? []),
        ...(TIER_2_KNOWN_GAPS[file] ?? []),
        ...(READ_ONLY[file] ?? []),
        ...(TOKEN_GATED[file] ?? []),
        ...(EXCLUDED[file] ?? []),
      ]);
      const unclassified = exportedFunctions(src).filter((fn) => !classified.has(fn));
      assert.deepEqual(
        unclassified,
        [],
        `${file}: new/unclassified exports (add to TIER_1/2, READ_ONLY, TOKEN_GATED or EXCLUDED): ${unclassified.join(', ')}`,
      );
    }
  });

  test('Tier-2 known gaps are still visible (report, not pass/fail)', () => {
    const gaps = Object.entries(TIER_2_KNOWN_GAPS).flatMap(([file, fns]) => fns.map((fn) => `${file}::${fn}`));
    assert.ok(gaps.length > 0, 'Tier-2 list should not be empty until the next wave lands');
    console.log(`B-8 Tier-2 known gaps (${gaps.length}): ${gaps.join(', ')}`);
  });
});

describe('B-8c: settleJobPaid is not an exported server action', () => {
  test('invoices.ts no longer exports settleJobPaid', () => {
    const src = readFileSync(join(ACTIONS_DIR, 'invoices.ts'), 'utf8');
    assert.ok(!/^export async function settleJobPaid/m.test(src), 'settleJobPaid is still an exported server action');
    assert.ok(!/settleJobPaidTx/.test(src.replace(/same bookkeeping as settleJobPaidTx/g, '')), 'settleJobPaidTx remnants in invoices.ts');
  });

  test('src/lib/settle-job-paid.ts exports it for server-side callers', () => {
    const src = readFileSync(join(LIB_DIR, 'settle-job-paid.ts'), 'utf8');
    assert.ok(/^export async function settleJobPaid/m.test(src), 'lib settleJobPaid missing');
    assert.ok(!/^'use server'/m.test(src), 'lib module must not be a use-server file');
  });
});
