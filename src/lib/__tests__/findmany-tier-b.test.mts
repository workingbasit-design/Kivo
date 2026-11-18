import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
const count = (src: string, sub: string) => src.split(sub).length - 1;

// P1.0 D Tier B — user-facing + dashboard + reports whole-table reads are
// bounded: LIST_MAX_SIZE caps on row reads, DB aggregates where the code
// sums money over fetched rows (a cap there would understate the total).
test('Tier B: capped sites carry exactly the expected LIST_MAX_SIZE caps', () => {
  const capped: Array<[string, number]> = [
    ['src/app/(app)/dispatch/page.tsx', 2],
    ['src/app/(app)/my-day/page.tsx', 1],
    ['src/app/(app)/voice/page.tsx', 1],
    ['src/app/(app)/routes/page.tsx', 1],
    ['src/app/(app)/layout.tsx', 1],
    ['src/app/today/page.tsx', 1],
    ['src/app/(app)/reports/team/page.tsx', 3],
    ['src/app/(app)/settings/team/page.tsx', 1],
    ['src/app/(app)/settings/booking/page.tsx', 2],
    ['src/app/(app)/settings/checklists/page.tsx', 1],
    ['src/app/(app)/settings/page.tsx', 1],
    ['src/app/(app)/timesheets/page.tsx', 1],
    ['src/app/(app)/customers/[id]/page.tsx', 1],
    ['src/app/book/[slug]/page.tsx', 1],
    ['src/app/p/[slug]/page.tsx', 2],
    ['src/lib/dashboard-sections.ts', 15],
    ['src/lib/reports-f9-data.ts', 6],
    ['src/lib/tax-summary.ts', 2],
    ['src/lib/insights.ts', 3],
    ['src/lib/dashboard.ts', 4],
    ['src/lib/digest.ts', 2],
    ['src/lib/review-eligibility.ts', 1],
    ['src/lib/attention.ts', 1],
    ['src/lib/customer-payment-summary.ts', 1],
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

test('Tier B: dashboard money sums are DB aggregates, not sums over rows', () => {
  const src = read('src/lib/dashboard-sections.ts');
  // getHeaderSummary ready-to-invoice: aggregate, not a row sum.
  assert.ok(
    src.includes('prisma.job.aggregate({\n    where: { businessId, archivedAt: null, status: "COMPLETED", invoices: { none: {} } },'),
    'header ready-to-invoice is a job aggregate',
  );
  assert.ok(!src.includes('ready.reduce('), 'header no longer sums fetched rows');
  // getKeyNumbers quotes: sum + count + expiring-soon count.
  assert.equal(count(src, 'prisma.quote.aggregate'), 2, 'two quote aggregates (key numbers + pipeline)');
  assert.equal(count(src, 'prisma.job.aggregate'), 4, 'four job aggregates (header ready + pipeline x3)');
  assert.ok(!src.includes('const sumCents ='), 'pipeline row-sum helper is gone');
  assert.ok(!src.includes('const sumQuoteCents ='), 'pipeline quote-sum helper is gone');
  assert.ok(
    src.includes('amount: centsToDollars(quoteAgg._sum.totalCents)'),
    'key-numbers quotes amount comes from the aggregate',
  );
  assert.ok(
    src.includes('updatedAt: { lte: expiringSoonCutoff, gt: expiredCutoff }'),
    'expiring-soon is a DB count over the same 23–30 day window',
  );
});

test('Tier B: review counts/averages come from aggregates, not row reads', () => {
  const share = read('src/app/(app)/directory-profile/share-card-section.tsx');
  assert.ok(share.includes('prisma.review.aggregate'), 'share card aggregates reviews');
  assert.ok(!share.includes('review.findMany'), 'share card no longer reads review rows');
  assert.ok(!share.includes('ratingSummary'), 'share card no longer uses ratingSummary');
  for (const rel of ['src/app/directory/page.tsx', 'src/app/customer/page.tsx']) {
    const src = read(rel);
    // 2026-11-18: the groupBy MUST go through unsafeUnscoped — the tenant
    // guard only accepts a plain-string where.businessId, so a guarded
    // businessId: { in: [...] } groupBy 500s the page (TenantScopeError).
    // The aggregate is public counts/averages over listed businesses only.
    assert.ok(
      src.includes("unsafeUnscoped('directory:review-ratings'"),
      `${rel} routes the review groupBy through the unscoped escape hatch`,
    );
    assert.ok(src.includes('review.groupBy'), `${rel} groups reviews by business`);
    assert.ok(
      !src.includes('prisma.review.groupBy'),
      `${rel} never calls groupBy on the guarded client`,
    );
    assert.ok(
      !src.includes('reviews: { select: { rating: true } }'),
      `${rel} no longer nests a whole-table reviews read`,
    );
    assert.ok(!src.includes('ratingSummary('), `${rel} no longer uses ratingSummary`);
  }
});

test('Tier B: attention dedupes invoiced jobs instead of capping the set', () => {
  const src = read('src/lib/attention.ts');
  assert.ok(src.includes("distinct: ['jobId']"), 'invoiced-job set uses distinct');
  assert.ok(
    src.includes('hasInvoice: invoicedJobIdSet.has(j.id)'),
    'the complete set still drives the hasInvoice flag',
  );
});

test('Tier B/C: documented naturally-bounded reads stay that way', () => {
  // getContinueLiveIds: an id-only live set — capping it would falsely
  // drop live records as stale. Pinned by its Tier C comment.
  const sections = read('src/lib/dashboard-sections.ts');
  assert.ok(
    sections.includes('P1.0-D Tier C: intentionally uncapped'),
    'getContinueLiveIds carries its Tier C exception note',
  );
  // Single-parent / id-list lookups are bounded by the parent/list, not by
  // a take — the bounding mechanism is the where clause itself.
  const projects = read('src/app/(app)/projects/[id]/page.tsx');
  assert.ok(
    projects.includes('jobId: { in: jobIds }'),
    'project invoices are bounded by the project job list',
  );
  const quotes = read('src/app/(app)/quotes/[id]/page.tsx');
  assert.ok(
    quotes.includes('where: { quoteId, businessId }'),
    'signature requests are bounded by the single quote',
  );
  const reviews = read('src/app/(app)/marketing/reviews/page.tsx');
  assert.ok(
    reviews.includes('jobId: { in: jobIds }'),
    'reviewed flags are bounded by the capped eligible list',
  );
});
