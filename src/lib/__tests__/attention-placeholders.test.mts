import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAttention, type AttentionInput } from '../attention.ts';
import { getDictionary } from '../i18n/index.ts';
import { fillTemplate } from '../revenue.ts';

// Regression test for the 2026-10-17 sweep finding: attention item details
// rendered raw "{customer}" / "{date}" placeholders because computeAttention
// did not supply every placeholder the template declares:
// - items.jobAtRisk.detail '{customer}, {date}' was missing customer
// - items.jobUnassigned.detail '{customer}, {date}' was missing date
// - items.jobUnbilled.detail '{customer}, no invoice yet' was missing customer
// (it passed an unused amount instead).
// The render path (AttentionBriefing renderLine -> fillTemplate) leaves
// unknown placeholders verbatim, so every declared placeholder must be
// covered by the item's params, in both locales.
const NOW = new Date('2026-10-04T14:00:00-04:00');

function baseInput(over: Partial<AttentionInput> = {}): AttentionInput {
  return {
    now: NOW,
    timezone: 'America/Toronto',
    invoices: [],
    quotes: [],
    jobs: [],
    leads: [],
    parts: [],
    paidThisWeek: { count: 0, total: 0 },
    ...over,
  };
}

const job = (over = {}) => ({
  id: 'j1',
  title: 'Fix sink',
  date: new Date('2026-10-04T09:00:00-04:00'),
  status: 'SCHEDULED',
  price: 150,
  technician: 'Mike',
  customerName: 'Cara',
  hasInvoice: true,
  ...over,
});

function getPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const p of path.split('.')) {
    if (cur && typeof cur === 'object' && p in cur) cur = (cur as Record<string, unknown>)[p];
    else return undefined;
  }
  return cur;
}

const RAW_PLACEHOLDER = /\{[^}]+\}/;

for (const locale of ['en', 'fr'] as const) {
  test(`attention job items render no raw placeholders (${locale})`, () => {
    const dict = getDictionary(locale) as Record<string, unknown>;
    const items = computeAttention(
      baseInput({
        jobs: [
          // at-risk: scheduled in the past, never started
          job({ id: 'jr', date: new Date('2026-10-01T09:00:00-04:00') }),
          // unassigned: scheduled today, no technician
          job({ id: 'ju', technician: null }),
          // unbilled: completed, no invoice
          job({ id: 'jb', status: 'COMPLETED', hasInvoice: false }),
        ],
      }),
    );
    assert.ok(items.length >= 3, `expected 3 job items, got ${items.length}`);
    for (const item of items) {
      for (const [which, key, params] of [
        ['title', item.titleKey, item.titleParams],
        ['detail', item.detailKey, item.detailParams],
      ] as const) {
        const template = getPath(dict, `attention.${key}`);
        assert.equal(
          typeof template,
          'string',
          `${locale} attention.${key} should be a plain template string`,
        );
        const rendered = fillTemplate(template as string, params);
        assert.ok(
          !RAW_PLACEHOLDER.test(rendered),
          `${locale} ${item.id} ${which} has raw placeholder: ${JSON.stringify(rendered)}`,
        );
      }
    }
  });
}
