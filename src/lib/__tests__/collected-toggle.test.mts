/**
 * FIX-NOW S2 (Collected toggle): functional test of the real CollectedCard.
 *
 * Plain node --test cannot parse TSX (node rejects .tsx before custom load
 * hooks run), so this test pre-compiles the real component sources with the
 * TypeScript compiler API (already a dev dependency) into
 * src/lib/__tests__/collected-build/, rewrites the `@/` + `next/link`
 * specifiers to real files, and renders the result with react-dom/server.
 * Everything rendered is the real component code — the only stand-in is
 * next/link (a plain <a>; the toggle test doesn't exercise routing).
 * The build directory is removed in an after() hook.
 *
 * Renders both toggle states (via `defaultMode`) in EN and FR and asserts:
 *   1. BOTH labels ("This week" / "This month", FR: "Cette semaine" /
 *      "Ce mois-ci") are present in the rendered output in BOTH states —
 *      no sliding-pill overlay can hide the unselected label.
 *   2. Toggling actually switches the data range: the displayed total /
 *      invoiced figures change between week and month.
 *   3. The selected option is marked aria-checked="true" with the hi-vis
 *      treatment, the other aria-checked="false" without it.
 *   4. Both buttons are 44px touch targets (min-h-[44px]).
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs \
 *      src/lib/__tests__/collected-toggle.test.mts
 */
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const ts = require('typescript');

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(HERE, '..', '..');
const BUILD = path.join(HERE, 'collected-build');

function compile(srcRel: string, outName: string, rewrites: [string, string][]) {
  const src = readFileSync(path.join(SRC, srcRel), 'utf8');
  const out = ts.transpileModule(src, {
    compilerOptions: {
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
    },
    fileName: srcRel,
  });
  let code: string = out.outputText;
  for (const [from, to] of rewrites) {
    code = code.split(`from "${from}"`).join(`from "${to}"`);
    code = code.split(`from '${from}'`).join(`from '${to}'`);
  }
  writeFileSync(path.join(BUILD, outName), code);
}

mkdirSync(BUILD, { recursive: true });
compile('components/dashboard/CollectedCard.tsx', 'CollectedCard.mjs', [
  ['next/link', '../collected-toggle-link-stub.mjs'],
  ['@/components/icons', './icons.mjs'],
  ['@/lib/money', '../../money.ts'],
  ['@/lib/utils', '../../utils.ts'],
]);
compile('components/icons.tsx', 'icons.mjs', [['./icons/phosphor', './phosphor.mjs']]);
compile('components/icons/phosphor.tsx', 'phosphor.mjs', []);

after(() => {
  rmSync(BUILD, { recursive: true, force: true });
});

const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { default: CollectedCard } = await import(
  pathToFileURL(path.join(BUILD, 'CollectedCard.mjs')).href
);
const { formatMoney } = await import('../money.ts');

const WEEK_TOTAL = 1234.56;
const MONTH_TOTAL = 98765.43;
const WEEK_INVOICED = 2000.0;
const MONTH_INVOICED = 120000.0;

function period(total: number, invoiced: number, months: string[]) {
  return {
    total,
    prevTotal: total / 2,
    changePct: 12,
    bars: [
      { key: 'd1', weekday: 0, amount: total / 3, isToday: true, isFuture: false },
      { key: 'd2', weekday: 1, amount: total / 3, isToday: false, isFuture: false },
      { key: 'd3', weekday: 2, amount: total / 3, isToday: false, isFuture: true },
    ],
    barMonths: months,
    invoiced,
    jobsDone: 4,
    jobsTotal: 6,
  };
}

const DATA = {
  week: period(WEEK_TOTAL, WEEK_INVOICED, []),
  month: period(MONTH_TOTAL, MONTH_INVOICED, ['2026-10', '2026-09', '2026-08']),
};

function labelsFor(locale: string) {
  const fr = locale === 'fr';
  return {
    collected: fr ? 'Encaissé' : 'Collected',
    thisWeek: fr ? 'Cette semaine' : 'This week',
    thisMonth: fr ? 'Ce mois-ci' : 'This month',
    trendUpTemplate: fr ? 'En hausse de {pct} % par rapport à {period}' : 'Up {pct}% vs {period}',
    trendDownTemplate: fr ? 'En baisse de {pct} % par rapport à {period}' : 'Down {pct}% vs {period}',
    periodWeek: fr ? 'cette semaine' : 'this week',
    periodMonth: fr ? 'ce mois-ci' : 'this month',
    invoiced: fr ? 'Facturé' : 'Invoiced',
    jobsDone: fr ? 'Travaux terminés' : 'Jobs done',
    jobsDoneOfTemplate: '{done} of {total}',
    chartSummaryTemplate: '{total} collected {period}',
    barLabelTemplate: '{amount} collected',
    showNumbers: fr ? 'Voir les chiffres' : 'Show numbers',
    hideNumbers: fr ? 'Masquer les chiffres' : 'Hide numbers',
    periodLabel: fr ? 'Période' : 'Period',
  };
}

function render(locale: string, defaultMode: string) {
  return renderToStaticMarkup(
    createElement(CollectedCard, {
      data: DATA,
      locale,
      labels: labelsFor(locale),
      defaultMode,
    })
  );
}

/** Extract the toggle's radiogroup markup so assertions target the toggle. */
function radiogroup(html: string) {
  const m = html.match(/<div[^>]*role="radiogroup"[^>]*>([\s\S]*?)<\/div>/);
  assert.ok(m, 'radiogroup must render');
  return m[1];
}

for (const locale of ['en', 'fr']) {
  const L = labelsFor(locale);

  test(`both toggle labels always visible (${locale})`, () => {
    for (const mode of ['week', 'month']) {
      const group = radiogroup(render(locale, mode));
      assert.ok(group.includes(L.thisWeek), `${locale}/${mode}: "${L.thisWeek}" visible`);
      assert.ok(group.includes(L.thisMonth), `${locale}/${mode}: "${L.thisMonth}" visible`);
      const buttons = group.match(/<button[\s\S]*?<\/button>/g) ?? [];
      assert.equal(buttons.length, 2);
      assert.ok(buttons.some((b) => b.includes(L.thisWeek)));
      assert.ok(buttons.some((b) => b.includes(L.thisMonth)));
    }
  });

  test(`toggling switches the displayed data range (${locale})`, () => {
    const weekHtml = render(locale, 'week');
    const monthHtml = render(locale, 'month');
    const weekTotal = formatMoney(WEEK_TOTAL, null, locale);
    const monthTotal = formatMoney(MONTH_TOTAL, null, locale);
    assert.ok(weekHtml.includes(weekTotal), `week view shows ${weekTotal}`);
    assert.ok(monthHtml.includes(monthTotal), `month view shows ${monthTotal}`);
    assert.ok(!weekHtml.includes(monthTotal), 'week view must not show the month total');
    assert.ok(!monthHtml.includes(weekTotal), 'month view must not show the week total');
    assert.ok(weekHtml.includes(formatMoney(WEEK_INVOICED, null, locale)));
    assert.ok(monthHtml.includes(formatMoney(MONTH_INVOICED, null, locale)));
    assert.ok(!weekHtml.includes(formatMoney(MONTH_INVOICED, null, locale)));
  });

  test(`selected option is marked + hi-vis, other is plain (${locale})`, () => {
    for (const mode of ['week', 'month']) {
      const group = radiogroup(render(locale, mode));
      const buttons = group.match(/<button[\s\S]*?<\/button>/g) ?? [];
      const label = mode === 'week' ? L.thisWeek : L.thisMonth;
      const other = mode === 'week' ? L.thisMonth : L.thisWeek;
      const selected = buttons.find((b) => b.includes(label));
      const unselected = buttons.find((b) => b.includes(other));
      assert.ok(selected, 'selected button renders');
      assert.ok(unselected, 'unselected button renders');
      assert.ok(selected.includes('aria-checked="true"'), 'selected is checked');
      assert.ok(selected.includes('bg-hivis'), 'selected gets the hi-vis treatment');
      assert.ok(unselected.includes('aria-checked="false"'), 'unselected is unchecked');
      assert.ok(!unselected.includes('bg-hivis'), 'unselected is not hi-vis');
    }
  });

  test(`both toggle buttons are 44px touch targets (${locale})`, () => {
    const group = radiogroup(render(locale, 'week'));
    const hits = group.match(/min-h-\[44px\]/g) ?? [];
    assert.ok(hits.length >= 2, `expected 2+ 44px targets, found ${hits.length}`);
  });
}

test('no absolutely-positioned pill overlay inside the toggle', () => {
  const group = radiogroup(render('en', 'week'));
  assert.ok(
    !/absolute/.test(group),
    'the toggle must not contain an overlay element that could cover a label'
  );
});
