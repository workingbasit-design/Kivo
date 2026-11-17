import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const SRC = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8');
const count = (src: string, sub: string) => src.split(sub).length - 1;

// P1.0 D2: Tier A — user-facing whole-table reads must be bounded.
test('D2: list pages use the M3 bounded-read pattern', () => {
  const pages: Array<[string, string]> = [
    ['src/app/(app)/leads/page.tsx', '/leads'],
    ['src/app/(app)/reviews/page.tsx', '/reviews'],
    ['src/app/(app)/pricebook/page.tsx', '/pricebook'],
    ['src/app/(app)/projects/page.tsx', '/projects'],
    ['src/app/(app)/recurring/page.tsx', '/recurring'],
    ['src/app/(app)/marketing/page.tsx', '/marketing'],
  ];
  for (const [rel, basePath] of pages) {
    const src = read(rel);
    assert.ok(src.includes('parseListLimit'), `${rel} parses ?limit=`);
    assert.ok(src.includes('takeWithProbe(limit)'), `${rel} probes the limit`);
    assert.ok(src.includes('sliceListPage('), `${rel} slices the page`);
    assert.ok(src.includes('ListMore'), `${rel} renders ListMore`);
    assert.ok(src.includes(`basePath="${basePath}"`), `${rel} ListMore basePath`);
    assert.ok(
      src.includes('.count(') || src.includes('.aggregate('),
      `${rel} total comes from a DB count/aggregate`,
    );
  }
  // leads: the "waiting" count must be a DB count, not a filter over the
  // fetched page (which would go wrong once the list is capped).
  const leads = read('src/app/(app)/leads/page.tsx');
  assert.ok(
    leads.includes("prisma.lead.count({ where: { businessId, status: 'NEW' } })"),
    'leads newCount is a DB count',
  );
  assert.ok(!leads.includes('.filter((l) => l.status'), 'leads no longer filters fetched rows');
  // recurring: the Show-more link must preserve the tab filter.
  const recurring = read('src/app/(app)/recurring/page.tsx');
  assert.ok(recurring.includes('params={{ filter }}'), 'recurring preserves ?filter=');
});

test('D2: picker + small-table reads carry a LIST_MAX_SIZE cap', () => {
  const capped: Array<[string, number]> = [
    ['src/app/(app)/crews/page.tsx', 1],
    ['src/app/(app)/subcontractors/page.tsx', 1],
    ['src/app/(app)/jobs/[id]/page.tsx', 3],
    ['src/app/(app)/jobs/page.tsx', 2],
    ['src/app/(app)/invoices/page.tsx', 1],
    ['src/app/(app)/quotes/page.tsx', 2],
    ['src/app/(app)/money/page.tsx', 1],
    ['src/app/(app)/jobs/new/page.tsx', 2],
    ['src/app/(app)/jobs/[id]/edit/page.tsx', 3],
    ['src/app/(app)/quotes/new/page.tsx', 2],
    ['src/app/(app)/invoices/new/page.tsx', 1],
    ['src/app/(app)/recurring/new/page.tsx', 2],
    ['src/app/(app)/recurring/[id]/edit/page.tsx', 2],
    ['src/app/api/customers/options/route.ts', 3],
  ];
  for (const [rel, want] of capped) {
    const src = read(rel);
    assert.ok(
      src.includes("from '@/lib/list-page'") || src.includes("from './list-page'"),
      `${rel} imports the list-page helpers`,
    );
    assert.equal(
      count(src, 'take: LIST_MAX_SIZE'),
      want,
      `${rel} has ${want} capped read(s)`,
    );
  }
});

test('D2: options endpoint filters customers server-side by ?q=', () => {
  const src = read('src/app/api/customers/options/route.ts');
  assert.ok(src.includes("searchParams.get('q')"), 'reads ?q=');
  assert.ok(src.includes("mode: 'insensitive'"), 'case-insensitive name match');
});

test('D2: schedule helpers are defensively capped', () => {
  const src = read('src/lib/job-queries.ts');
  const week = src.slice(src.indexOf('export async function getScheduleWeekJobs'));
  assert.ok(week.includes('take: LIST_MAX_SIZE'), 'getScheduleWeekJobs is capped');
  const today = src.slice(src.indexOf('export async function getTodayJobs'));
  assert.ok(today.includes('take: LIST_MAX_SIZE'), 'getTodayJobs is capped');
});
