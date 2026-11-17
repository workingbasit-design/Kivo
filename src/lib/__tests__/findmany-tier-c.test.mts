import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
const count = (src: string, sub: string) => src.split(sub).length - 1;

// P1.0 D Tier C — the remaining findMany sites: cron + helper + action
// reads get LIST_MAX_SIZE caps; reads whose correctness needs the complete
// set (exports, import dedupe, idempotency sets, cron scans) are pinned as
// documented Tier C exceptions instead of capped.
test('Tier C: capped sites carry exactly the expected LIST_MAX_SIZE caps', () => {
  const capped: Array<[string, number]> = [
    // Shared with Tier B (cumulative counts — Tier C added one more each).
    ['src/app/(app)/settings/booking/page.tsx', 2],
    ['src/app/p/[slug]/page.tsx', 2],
    // Pre-existing D2 caps on the quotes page, unchanged by Tier C.
    ['src/app/(app)/quotes/page.tsx', 2],
    ['src/app/actions/services.ts', 1],
    ['src/app/actions/designations.ts', 1],
    ['src/app/actions/batch-invoicing.ts', 1],
    ['src/app/actions/custom-fields.ts', 6],
    ['src/app/actions/customer-properties.ts', 1],
    ['src/app/actions/subcontractors.ts', 2],
    ['src/app/actions/template-overrides.ts', 1],
    ['src/app/actions/attachments.ts', 1],
    ['src/app/actions/imports.ts', 1],
    ['src/lib/copilot/engine.ts', 1],
    ['src/lib/googleCalendarSync.ts', 1],
    ['src/lib/route-optimizer.ts', 1],
    ['src/lib/messaging/engine.ts', 2],
    ['src/lib/recurring.ts', 1],
    ['src/lib/scheduled-invoices.ts', 1],
    ['src/lib/customer-agent-keys.ts', 1],
    ['src/lib/workflows.ts', 2],
    ['src/lib/webhooks.ts', 1],
    ['src/lib/webpush.ts', 1],
    ['src/app/api/integrations/api-keys/route.ts', 1],
    ['src/app/api/integrations/webhooks/route.ts', 1],
    ['src/app/api/push/test/route.ts', 1],
    ['src/app/customer/requests/page.tsx', 1],
  ];
  for (const [rel, expected] of capped) {
    const src = read(rel);
    assert.equal(
      count(src, 'take: LIST_MAX_SIZE'),
      expected,
      `${rel} carries ${expected} LIST_MAX_SIZE caps`,
    );
  }
});

test('Tier C: completeness-required reads are pinned uncapped, with reasons', () => {
  // Each allowlisted site carries its Tier C comment at the site; the
  // counts below pin the comment so a future cap can't land silently.
  const allowlisted: Array<[string, number]> = [
    ['src/lib/export.ts', 1],
    ['src/app/actions/accounting-export.ts', 1],
    ['src/app/actions/imports.ts', 6],
    ['src/app/actions/marketing.ts', 1],
    ['src/lib/messaging/engine.ts', 2],
    ['src/lib/workflows.ts', 1],
    ['src/app/api/cron/recurring/route.ts', 1],
    ['src/app/api/cron/workflows/route.ts', 1],
    ['src/app/api/cron/error-alerts/route.ts', 1],
    ['src/app/api/integrations/quickbooks/sync/route.ts', 1],
    ['src/app/actions/google-reviews.ts', 1],
    ['src/app/(app)/quotes/page.tsx', 1],
  ];
  for (const [rel, expected] of allowlisted) {
    const src = read(rel);
    assert.equal(
      count(src, 'P1.0-D Tier C'),
      expected,
      `${rel} carries ${expected} Tier C exception note(s)`,
    );
  }
  // And none of the whole-table-by-design files may gain a take: a cap
  // there would silently truncate an export, drop campaign recipients,
  // starve a cron tick, or break an idempotency set.
  const neverCapped = [
    'src/lib/export.ts',
    'src/app/actions/accounting-export.ts',
    'src/app/actions/marketing.ts',
    'src/app/api/cron/recurring/route.ts',
    'src/app/api/cron/workflows/route.ts',
    'src/app/api/cron/error-alerts/route.ts',
    'src/app/api/integrations/quickbooks/sync/route.ts',
    'src/app/actions/google-reviews.ts',
  ];
  for (const rel of neverCapped) {
    assert.equal(
      count(read(rel), 'take: LIST_MAX_SIZE'),
      0,
      `${rel} must stay uncapped (Tier C)`,
    );
  }
});

test('Tier C: id/in:-list lookups stay bounded by the list, not a take', () => {
  const audit = read('src/app/(app)/settings/audit/page.tsx');
  assert.ok(
    audit.includes('where: { id: { in: actorIds } }'),
    'audit actors are bounded by the capped page rows',
  );
  const batch = read('src/app/actions/batch-invoicing.ts');
  assert.ok(
    batch.includes('where: { id: { in: ids }, businessId }'),
    'batch invoicing is bounded by the user selection',
  );
  const booking = read('src/app/actions/booking.ts');
  assert.ok(
    booking.includes('id: { in: requestedIds'),
    'booking services are bounded by the submitted ids',
  );
  const concierge = read('src/app/actions/concierge.ts');
  assert.ok(
    concierge.includes('id: { in: uniqueBusinessIds }'),
    'concierge eligibility is bounded by the request ids',
  );
  assert.ok(
    concierge.includes('id: { in: existing.businessIds }'),
    'concierge resend names are bounded by the stored send',
  );
  const marketing = read('src/app/actions/marketing.ts');
  assert.equal(
    count(marketing, 'id: { in: ids }'),
    2,
    'marketing unpaid/recent audiences are bounded by the distinct-id lists',
  );
  const sections = read('src/lib/dashboard-sections.ts');
  assert.ok(
    sections.includes('in: [...new Set(completedJobs.map((j) => j.customerId))]'),
    'next-action paid lookup is bounded by the 10 completed jobs',
  );
});
