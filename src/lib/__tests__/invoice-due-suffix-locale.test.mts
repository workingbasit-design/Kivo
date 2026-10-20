/**
 * Regression test for the 2026-10-18 morning QA finding: under the FR
 * locale, the invoices list rendered a mixed-locale due hint — "$56.50 dû"
 * (en-CA money format with a French suffix) — because InvoicesClient called
 * formatMoney(due, currency) without the locale argument, while the rest of
 * the page (and the FR suffix itself) used fr-CA formatting ("56,50 $").
 *
 * Guards:
 *  1. The FR due-suffix composition renders fr-CA money ("56,50 $ dû").
 *  2. The EN composition is unchanged ("$56.50 due").
 *  3. Source guard: every formatMoney( call in InvoicesClient.tsx passes an
 *     explicit locale (3rd arg), so this cannot regress silently.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { t } from '../i18n/index.ts';
import { formatMoney } from '../money.ts';
import { localeMoneyTag } from '../utils.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLIENT = join(__dirname, '..', '..', 'app', '(app)', 'invoices', 'InvoicesClient.tsx');

function dueSuffixLabel(due: number, currency: string, locale: 'en' | 'fr'): string {
  return t(locale, 'billing.dueSuffix').replace(
    '{amount}',
    formatMoney(due, currency, localeMoneyTag(locale)),
  );
}

test('FR invoice due suffix uses fr-CA money format (no mixed "$56.50 dû")', () => {
  const label = dueSuffixLabel(56.5, 'CAD', 'fr');
  assert.ok(label.includes('dû'), `expected French suffix, got: ${label}`);
  assert.ok(!label.includes('$56.50'), `mixed en-CA format leaked into FR label: ${label}`);
  assert.ok(/56,50/.test(label), `expected fr-CA decimals, got: ${label}`);
});

test('EN invoice due suffix unchanged', () => {
  assert.equal(dueSuffixLabel(56.5, 'CAD', 'en'), '$56.50 due');
});

/** Extract the argument list of every formatMoney( call in a source file. */
function formatMoneyCallArgCounts(src: string): number[] {
  const counts: number[] = [];
  const needle = 'formatMoney(';
  let from = 0;
  while (true) {
    const i = src.indexOf(needle, from);
    if (i === -1) break;
    let depth = 0;
    let topCommas = 0;
    let j = i + needle.length - 1; // at '('
    for (; j < src.length; j++) {
      const c = src[j];
      if (c === '(') depth++;
      else if (c === ')') {
        depth--;
        if (depth === 0) break;
      } else if (c === ',' && depth === 1) topCommas++;
    }
    counts.push(topCommas + 1);
    from = j + 1;
  }
  return counts;
}

test('InvoicesClient passes an explicit locale to every formatMoney call', () => {
  const src = readFileSync(CLIENT, 'utf8');
  const counts = formatMoneyCallArgCounts(src);
  assert.ok(counts.length > 0, 'no formatMoney calls found in InvoicesClient.tsx');
  for (const n of counts) {
    assert.equal(n, 3, `formatMoney call without explicit locale (got ${n} args) in InvoicesClient.tsx`);
  }
});
