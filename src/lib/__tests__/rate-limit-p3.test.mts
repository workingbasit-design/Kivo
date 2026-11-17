import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// P1.0 S4 P3: every authenticated action + route must rate-limit against the
// shared DB store, not the per-instance in-memory bucket.
const P3_FILES = [
  // A: async checkLimit helpers
  'src/app/actions/attachments.ts',
  'src/app/actions/automations.ts',
  'src/app/actions/crews.ts',
  'src/app/actions/customers.ts',
  'src/app/actions/demo.ts',
  'src/app/actions/directory-profile.ts',
  'src/app/actions/dispatch.ts',
  'src/app/actions/equipment.ts',
  'src/app/actions/expenses.ts',
  'src/app/actions/google-reviews.ts',
  'src/app/actions/imports.ts',
  'src/app/actions/inventory.ts',
  'src/app/actions/jobops.ts',
  'src/app/actions/jobs.ts',
  'src/app/actions/leads.ts',
  'src/app/actions/onboarding.ts',
  'src/app/actions/projects.ts',
  'src/app/actions/recurring.ts',
  'src/app/actions/timesheets.ts',
  // B: sync checkLimit helpers (now async)
  'src/app/actions/batch-invoicing.ts',
  'src/app/actions/custom-fields.ts',
  'src/app/actions/customer-properties.ts',
  'src/app/actions/messaging.ts',
  'src/app/actions/quotes.ts',
  'src/app/actions/stripe.ts',
  'src/app/actions/subcontractors.ts',
  'src/app/actions/invoices.ts',
  // C: sync limited() helpers (now async)
  'src/app/actions/designations.ts',
  'src/app/actions/marketing.ts',
  'src/app/actions/reviews.ts',
  'src/app/actions/services.ts',
  'src/app/actions/settings.ts',
  // D: direct calls in async actions
  'src/app/actions/booking-slots.ts',
  'src/app/actions/booking.ts',
  'src/app/actions/brand.ts',
  'src/app/actions/concierge.ts',
  'src/app/actions/digest.ts',
  'src/app/actions/esign.ts',
  'src/app/actions/portal.ts',
  'src/app/actions/reports-f9.ts',
  'src/app/actions/reports.ts',
  'src/app/actions/review-requests.ts',
  'src/app/actions/routes.ts',
  // E: API routes
  'src/app/api/copilot/route.ts',
  'src/app/api/export/route.ts',
  'src/app/api/integrations/api-keys/route.ts',
  'src/app/api/integrations/quickbooks/callback/route.ts',
  'src/app/api/integrations/quickbooks/connect/route.ts',
  'src/app/api/integrations/quickbooks/disconnect/route.ts',
  'src/app/api/integrations/quickbooks/sync/route.ts',
  'src/app/api/integrations/webhooks/route.ts',
  'src/app/api/locations/latest/route.ts',
  'src/app/api/locations/ping/route.ts',
  'src/app/api/offline-jobs/route.ts',
  'src/app/api/push/subscribe/route.ts',
  'src/app/api/push/test/route.ts',
  'src/app/api/push/unsubscribe/route.ts',
  'src/app/api/reports/run/route.ts',
  'src/app/api/search/route.ts',
  'src/app/api/stripe/invoice-checkout/route.ts',
  'src/app/api/tracking/share/route.ts',
];

test('S4 P3: all authenticated surfaces use the durable limiter', () => {
  assert.equal(P3_FILES.length, 61, 'P3 file list must stay complete');
  for (const rel of P3_FILES) {
    const p = join(SRC, rel);
    assert.ok(existsSync(p), `${rel} exists`);
    const src = readFileSync(p, 'utf8');
    assert.ok(
      src.includes("from '@/lib/rate-limit-durable'"),
      `${rel} imports the durable limiter`,
    );
    assert.ok(src.includes('rateLimitDurable('), `${rel} calls rateLimitDurable(`);
    assert.ok(
      !src.includes("from '@/lib/rate-limit'") || src.includes("from '@/lib/rate-limit-durable'"),
      `${rel} must not import the in-memory limiter`,
    );
    assert.ok(
      !/(?<![A-Za-z])rateLimit\s*\(/.test(src),
      `${rel} must not call the in-memory rateLimit(`,
    );
  }
});

test('S4 P3: formerly-sync limit helpers are async and awaited at call sites', () => {
  const syncHelpers: Array<[string, string, RegExp]> = [
    ['src/app/actions/batch-invoicing.ts', 'checkLimit', /async function checkLimit\(/],
    ['src/app/actions/custom-fields.ts', 'checkLimit', /async function checkLimit\(/],
    ['src/app/actions/customer-properties.ts', 'checkLimit', /async function checkLimit\(/],
    ['src/app/actions/messaging.ts', 'checkLimit', /async function checkLimit\(/],
    ['src/app/actions/quotes.ts', 'checkLimit', /async function checkLimit\(/],
    ['src/app/actions/quotes.ts', 'checkPortalLimit', /async function checkPortalLimit\(/],
    ['src/app/actions/stripe.ts', 'checkLimit', /async function checkLimit\(/],
    ['src/app/actions/subcontractors.ts', 'checkLimit', /async function checkLimit\(/],
    ['src/app/actions/invoices.ts', 'checkLimit', /async function checkLimit\(/],
    ['src/app/actions/designations.ts', 'limited', /async function limited\(/],
    ['src/app/actions/marketing.ts', 'limited', /async function limited\(/],
    ['src/app/actions/reviews.ts', 'limited', /async function limited\(/],
    ['src/app/actions/services.ts', 'limited', /async function limited\(/],
    ['src/app/actions/settings.ts', 'limited', /async function limited\(/],
  ];
  for (const [rel, name, sig] of syncHelpers) {
    const src = readFileSync(join(SRC, rel), 'utf8');
    assert.ok(sig.test(src), `${rel}: ${name} is async`);
    // every call site awaits the helper (no `= checkLimit(` / `= limited(` left)
    assert.ok(
      !new RegExp(`= ${name}\\(`).test(src),
      `${rel}: every ${name}( call site is awaited`,
    );
  }
});
