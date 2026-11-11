/**
 * Database-frontend audit fixes M1, M2, M3 (2026-11-11).
 *
 * Each test fails on the pre-fix code:
 *  M1 - /book/[slug] listed every Service row; BookableService was dead.
 *  M2 - Business.gstHstRegistered was never read; tax was unconditional.
 *  M3 - the dashboard counts and the list screens loaded every row.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  LIST_PAGE_SIZE,
  LIST_MAX_SIZE,
  parseListLimit,
  takeWithProbe,
  sliceListPage,
} from '../list-page.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (rel: string) => readFileSync(`${root}${rel}`, 'utf8');
const readCode = (rel: string) =>
  read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('M1 - only curated services are bookable', () => {
  it('the public booking page reads BookableService, not every Service', () => {
    const code = readCode('src/app/book/[slug]/page.tsx');
    assert.match(code, /bookableService\.findMany/, 'must read the curated list');
    assert.match(code, /active: true/, 'inactive entries must be excluded');
    assert.ok(
      !/prisma\.service\.findMany/.test(code),
      'must not fall back to listing every price-book service',
    );
  });

  it('the curated list is ordered by its position column', () => {
    const code = readCode('src/app/book/[slug]/page.tsx');
    assert.match(code, /orderBy: \[\{ position: 'asc' \}\]/);
  });

  it('saving booking settings syncs the list and trusts no id from the form', () => {
    const code = readCode('src/app/actions/booking.ts');
    assert.match(code, /bookableServiceIds/, 'must read the submitted selection');
    assert.match(code, /bookableService\.deleteMany/, 'must sync rows');
    // Ids are filtered through the business's own services before use.
    assert.match(code, /service\.findMany\(\{[\s\S]*?businessId[\s\S]*?id: \{ in:/);
  });

  it('the settings page and the save both scope BookableService by businessId', () => {
    // 2026-11-11 evening: the unscoped findMany crashed /settings/booking
    // on every load (tenant guard fails closed), and the upsert in the
    // save could not carry a businessId at all (its unique key has none).
    const page = readCode('src/app/(app)/settings/booking/page.tsx');
    assert.match(page, /bookableService\.findMany\(\{[\s\S]*?businessId/);
    const action = readCode('src/app/actions/booking.ts');
    assert.match(action, /bookableService\.deleteMany\(\{[\s\S]*?businessId/);
    assert.match(action, /bookableService\.updateMany\(\{[\s\S]*?businessId/);
    assert.ok(!/bookableService\.upsert/.test(action), 'upsert cannot scope by businessId here');
  });

  it('a backfill migration seeds existing pages so none goes blank', () => {
    const sql = read(
      'prisma/migrations/20261111120000_m31_backfill_bookable_services/migration.sql',
    );
    assert.match(sql, /INSERT INTO "BookableService"/);
    assert.match(sql, /ON CONFLICT[\s\S]*DO NOTHING/i, 'must be re-runnable');
  });
});

describe('M2 - tax only when registered to collect it', () => {
  it('invoice creation forces a zero rate when not registered', () => {
    const code = readCode('src/app/actions/invoices.ts');
    assert.match(code, /isGstHstRegistered/, 'must read the flag');
    assert.match(code, /registered \? submittedTaxType : 'GST'/);
    assert.match(code, /registered \? \(taxRateFromForm \?\? totalTaxRate\(taxConfig\)\) : 0/);
  });

  it('a composite tax type is never stored at rate 0', () => {
    // splitStoredTax derives the provincial share as (total - 5), so
    // 'GST+QST' at rate 0 would split into GST 5% / QST -5%. The zero case
    // must therefore collapse to the single 'GST' route.
    const code = readCode('src/app/actions/invoices.ts');
    assert.match(code, /: 'GST'/);
  });

  it('quote creation returns no tax lines when not registered', () => {
    const code = readCode('src/app/actions/quotes.ts');
    assert.match(code, /registered: boolean/);
    assert.match(code, /if \(!registered\) return \[\];/);
    assert.match(code, /gstHstRegistered: true/, 'the flag must be selected');
  });

  it('enforcement is server-side, not just hidden in the builder', () => {
    // The forms post taxType/taxRate, so a stale tab or hand-crafted POST
    // must not be able to add tax to an unregistered business.
    for (const f of ['src/app/actions/invoices.ts', 'src/app/actions/quotes.ts']) {
      assert.match(readCode(f), /gstHstRegistered/, `${f} must check the flag`);
    }
  });

  it('Settings exposes the toggle and persists it', () => {
    assert.match(readCode('src/components/SettingsForm.tsx'), /name="gstHstRegistered"/);
    const action = readCode('src/app/actions/settings.ts');
    assert.match(action, /gstHstRegistered: z\.coerce\.boolean\(\)/);
    assert.match(action, /gstHstRegistered,/);
  });

  it('both builders hide the tax control when not registered', () => {
    for (const f of [
      'src/app/(app)/invoices/new/InvoiceForm.tsx',
      'src/app/(app)/quotes/new/QuoteForm.tsx',
    ]) {
      const code = readCode(f);
      assert.match(code, /gstHstRegistered \? /, `${f} must branch on the flag`);
      assert.match(code, /taxRate: 0/, `${f} must default to a zero rate`);
    }
  });

  it('a backfill keeps already-registered businesses charging tax', () => {
    const sql = read(
      'prisma/migrations/20261111130000_m32_backfill_gst_registered/migration.sql',
    );
    // Evidence of registration: a GST/HST number on file, or invoices that
    // already carried tax. Without this the false default would silently
    // stop every existing business from charging GST/HST.
    assert.match(sql, /UPDATE "Business"/);
    assert.match(sql, /gstin/);
    assert.match(sql, /taxAmountCents/);
    assert.match(sql, /"gstHstRegistered" = false/, 'must only ever flip false -> true');
  });

  it('the QST rule is untouched', () => {
    const tax = read('src/lib/tax.ts');
    assert.match(tax, /name: 'QST', rate: 9\.975/);
    assert.match(tax, /EXCLUDING GST/);
  });
});

describe('M3 - bounded reads', () => {
  it('getJobCounts aggregates in SQL instead of loading every job', () => {
    const code = readCode('src/lib/job-queries.ts');
    const counts = code.slice(code.indexOf('export async function getJobCounts'));
    const body = counts.slice(0, counts.indexOf('export async function getMoneySummary'));
    assert.match(body, /groupBy/, 'per-status counts must come from the database');
    assert.match(body, /job\.count/, 'uninvoiced/late must be counted in SQL');
    assert.ok(!/job\.findMany/.test(body), 'must not fetch job rows to count them');
  });

  it('the SQL late filter shares its status list with isJobLate', () => {
    assert.match(read('src/lib/job-status.ts'), /export const LATE_ELIGIBLE_STATUSES/);
    assert.match(readCode('src/lib/job-queries.ts'), /LATE_ELIGIBLE_STATUSES/);
  });

  it('getMoneySummary sums in SQL and keeps the per-invoice clamp', () => {
    const code = readCode('src/lib/job-queries.ts');
    const body = code.slice(code.indexOf('export async function getMoneySummary'));
    assert.match(body, /invoice\.aggregate/, 'UNPAID totals must be summed by the database');
    assert.match(body, /job\.aggregate/, 'ready-to-invoice must be summed by the database');
    // PARTIALLY PAID still needs the per-invoice Math.max(0, ...) clamp, so
    // those rows are walked in bounded pages rather than all at once.
    assert.match(body, /Math\.max\(0, total - paid\)/, 'clamp must be preserved');
    assert.match(body, /take: PAGE/, 'the walk must be paged');
  });

  it('every list screen caps its read', () => {
    for (const f of [
      'src/app/(app)/jobs/page.tsx',
      'src/app/(app)/customers/page.tsx',
      'src/app/(app)/invoices/page.tsx',
      'src/app/(app)/quotes/page.tsx',
    ]) {
      const code = readCode(f);
      assert.match(code, /takeWithProbe\(limit\)/, `${f} must cap its fetch`);
      assert.match(code, /sliceListPage/, `${f} must detect more rows`);
      assert.match(code, /ListMore/, `${f} must offer the rest`);
    }
  });

  it('customers no longer pulls every job row to sum revenue', () => {
    const code = readCode('src/app/(app)/customers/page.tsx');
    assert.ok(
      !/jobs: \{ select: \{ priceCents: true \} \}/.test(code),
      'per-customer job rows must not be fetched',
    );
    assert.match(code, /groupBy/, 'revenue must be summed by the database');
  });

  it('invoice money totals are summed in SQL, not from the page', () => {
    const code = readCode('src/app/(app)/invoices/page.tsx');
    assert.match(code, /invoice\.aggregate/);
    assert.match(code, /payment\.aggregate/);
    // Capping a list is safe; deriving a total from a capped list is not.
    assert.ok(
      !/aggregates\s*\.filter/.test(code),
      'totals must not be reduced from the fetched page',
    );
  });

  it('parseListLimit clamps hostile and junk input', () => {
    assert.equal(parseListLimit(undefined), LIST_PAGE_SIZE);
    assert.equal(parseListLimit(''), LIST_PAGE_SIZE);
    assert.equal(parseListLimit('abc'), LIST_PAGE_SIZE);
    assert.equal(parseListLimit('-5'), LIST_PAGE_SIZE);
    assert.equal(parseListLimit('0'), LIST_PAGE_SIZE);
    assert.equal(parseListLimit('1.5'), LIST_PAGE_SIZE);
    assert.equal(parseListLimit('50'), 50);
    // A hostile ?limit cannot be used to force a full table scan.
    assert.equal(parseListLimit('999999999'), LIST_MAX_SIZE);
    assert.equal(parseListLimit(['300', '10']), 300);
  });

  it('the probe row detects more rows without a second count', () => {
    assert.equal(takeWithProbe(200), 201);
    const exact = sliceListPage([1, 2, 3], 3);
    assert.equal(exact.hasMore, false);
    assert.equal(exact.nextLimit, null);
    assert.deepEqual(exact.rows, [1, 2, 3]);
    const more = sliceListPage([1, 2, 3, 4], 3);
    assert.equal(more.hasMore, true);
    assert.deepEqual(more.rows, [1, 2, 3], 'the probe row is never rendered');
    assert.ok(more.nextLimit !== null && more.nextLimit > 3);
  });

  it('nextLimit never exceeds the ceiling', () => {
    const at = sliceListPage(new Array(LIST_MAX_SIZE + 1).fill(0), LIST_MAX_SIZE);
    assert.equal(at.nextLimit, LIST_MAX_SIZE);
  });
});

describe('M3 follow-on - the invoices list aggregates scope by businessId', () => {
  it('both payment aggregates carry a top-level businessId', () => {
    // 2026-11-11 evening: the relation-only scope crashed /invoices on
    // every load (Payment is a tenant model; the guard fails closed).
    const code = readCode('src/app/(app)/invoices/page.tsx');
    const aggregates = [...code.matchAll(/payment\.aggregate\(\{[\s\S]*?_sum/g)].map((m) => m[0]);
    assert.equal(aggregates.length, 2, 'expected two payment aggregates');
    for (const agg of aggregates) {
      assert.match(agg, /businessId,/, 'aggregate must scope by businessId at the top level');
    }
  });
});

describe('M2 follow-on - no zero tax line when no tax is charged', () => {
  it('invoice and quote previews hide the breakdown while tax is zero', () => {
    for (const rel of [
      'src/app/(app)/invoices/new/InvoiceForm.tsx',
      'src/app/(app)/quotes/new/QuoteForm.tsx',
    ]) {
      assert.match(readCode(rel), /taxAmount > 0 && (lines|breakdown)\.map/);
    }
  });

  it('the saved invoice detail hides the breakdown while tax is zero', () => {
    const code = readCode('src/app/(app)/invoices/[id]/page.tsx');
    assert.match(code, /taxAmountDollars > 0 && taxLines\.map/);
  });
});

describe('D6 follow-on - WhatsApp tint button in dark mode', () => {
  it('the tint buttons use the bright brand green as dark-mode text', () => {
    // #0E7A3E on the 10% tint is 5.04:1 in light mode but 2.81–3.16:1 in
    // dark mode; #25D366 on the same dark backdrops is 7.69–8.64:1.
    for (const rel of ['src/components/WhatsAppButton.tsx', 'src/components/PortalLinkManager.tsx']) {
      assert.match(readCode(rel), /text-wa-deep dark:text-wa/);
    }
  });
});
