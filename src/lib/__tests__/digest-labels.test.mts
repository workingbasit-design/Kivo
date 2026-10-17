import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getDictionary } from '../i18n/index.ts';

// Regression test for the 2026-10-17 sweep finding: the digest money cards
// rendered raw "{amount} overdue" / "{amount} outstanding" placeholders.
// src/app/(app)/digest/page.tsx passes digest.overdue / digest.outstanding
// as StatCard *labels* (the amount is the card value), so these strings must
// be plain labels with no {placeholders}. The count/amount variants that ARE
// interpolated at the render site (overdueCount, paidWeek, weekRevenue)
// intentionally keep their placeholders.
const PLAIN_LABEL_KEYS = ['digest.overdue', 'digest.outstanding'];

function getPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const p of path.split('.')) {
    if (cur && typeof cur === 'object' && p in cur) cur = (cur as Record<string, unknown>)[p];
    else return undefined;
  }
  return cur;
}

for (const locale of ['en', 'fr'] as const) {
  test(`digest money-card labels have no raw placeholders (${locale})`, () => {
    const dict = getDictionary(locale) as Record<string, unknown>;
    for (const key of PLAIN_LABEL_KEYS) {
      const s = getPath(dict, key);
      assert.equal(typeof s, 'string', `${locale}.${key} should exist`);
      assert.ok(
        !/\{[^}]+\}/.test(s as string),
        `${locale}.${key} rendered raw on the digest page: ${JSON.stringify(s)}`,
      );
    }
  });
}
