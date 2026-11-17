/**
 * Regression test: Reviews "Add a review" must explain why Save is
 * unavailable when the business has no completed + paid job.
 *
 * The Save button was already disabled in that state, but the shared kit
 * Button rendered disabled primary buttons at full hi-vis lime (the kit CSS
 * only styles `.btn:disabled`, which kit buttons never carry), so users
 * tapped it, nothing happened, and no reason was visible at the point of
 * action — reported as "save button not working".
 *
 * Renders the real AddReviewForm (pre-compiled with the TypeScript compiler
 * API, same pattern as collected-toggle.test.mts) and asserts:
 *   1. With no eligible jobs (EN + FR): a visible notice explains why, and
 *      the submit button carries the disabled attribute.
 *   2. With an eligible job: no notice, and the submit button is enabled.
 * Stubs: sonner, the reviews server actions, ConfirmDialog, and the kit
 * (minimal stand-ins that pass props through); icons are the real ones;
 * i18n + utils are the real modules.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs
 *   src/lib/__tests__/reviews-save-disabled.test.mts
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
const BUILD = path.join(HERE, 'reviews-save-build');

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
compile('components/ReviewsClient.tsx', 'ReviewsClient.mjs', [
  ['@/components/icons', './icons.mjs'],
  ['sonner', './sonner.mjs'],
  ['@/app/actions/reviews', './reviews-actions.mjs'],
  ['@/components/ConfirmDialog', './confirm-dialog.mjs'],
  ['@/components/kit', './kit.mjs'],
  ['@/lib/i18n', '../../i18n/index.ts'],
  ['@/lib/utils', '../../utils.ts'],
]);
compile('components/icons.tsx', 'icons.mjs', [['./icons/phosphor', './phosphor.mjs']]);
compile('components/icons/phosphor.tsx', 'phosphor.mjs', []);

// Minimal kit stand-ins: pass props through so the test observes the real
// form logic (disabled state, notice) without pulling the whole kit tree.
writeFileSync(
  path.join(BUILD, 'kit.mjs'),
  `import { createElement as h } from 'react';
export function Button({ children, ...props }) { return h('button', props, children); }
export function Card({ children, ...props }) { return h('div', props, children); }
export function EmptyState() { return null; }
export function Select({ label, hint, name, required, defaultValue, options = [] }) {
  return h('div', null,
    label ? h('label', null, label) : null,
    h('select', { name, required, defaultValue },
      options.map((o) => h('option', { key: o.value, value: o.value, disabled: o.disabled }, o.label))),
    hint ? h('p', null, hint) : null);
}
export function SummaryCard() { return null; }
export function Textarea(props) { return h('textarea', props); }
`,
);
writeFileSync(
  path.join(BUILD, 'sonner.mjs'),
  `export const toast = { success() {}, error() {} };\n`,
);
writeFileSync(
  path.join(BUILD, 'reviews-actions.mjs'),
  `export async function createReview() { return { ok: true }; }\nexport async function deleteReview() { return { ok: true }; }\n`,
);
writeFileSync(
  path.join(BUILD, 'confirm-dialog.mjs'),
  `export default function ConfirmDialog() { return null; }\n`,
);

after(() => {
  rmSync(BUILD, { recursive: true, force: true });
});

const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { AddReviewForm } = await import(
  pathToFileURL(path.join(BUILD, 'ReviewsClient.mjs')).href
);

const NOTICE_EN =
  'No completed, paid jobs yet. Record one to add a review.';
const NOTICE_FR =
  'Aucun travail terminé et payé pour l’instant. Enregistrez-en un pour ajouter un avis.';

function renderForm(eligibleJobs: { id: string; title: string; customerName: string }[], locale: string) {
  return renderToStaticMarkup(
    createElement(AddReviewForm, { eligibleJobs, locale, initialShow: true }),
  );
}

/** The submit button's opening tag, or null if none rendered. */
function submitButtonTag(html: string): string | null {
  const tags = html.match(/<button[^>]*>/g) ?? [];
  return tags.find((tag) => tag.includes('type="submit"')) ?? null;
}

test('no eligible jobs (EN): reason visible at Save, submit disabled', () => {
  const html = renderForm([], 'en');
  assert.ok(
    html.includes('data-testid="review-no-jobs-notice"'),
    'expected the no-jobs notice next to Save',
  );
  assert.ok(html.includes(NOTICE_EN), 'expected the EN reason text');
  const submit = submitButtonTag(html);
  assert.ok(submit, 'expected a submit button');
  assert.ok(submit.includes('disabled'), `submit must be disabled, got: ${submit}`);
});

test('no eligible jobs (FR): reason visible at Save, submit disabled', () => {
  const html = renderForm([], 'fr');
  assert.ok(
    html.includes('data-testid="review-no-jobs-notice"'),
    'expected the no-jobs notice next to Save',
  );
  assert.ok(html.includes(NOTICE_FR), 'expected the FR reason text');
  const submit = submitButtonTag(html);
  assert.ok(submit, 'expected a submit button');
  assert.ok(submit.includes('disabled'), `submit must be disabled, got: ${submit}`);
});

test('eligible job present: no notice, submit enabled', () => {
  const html = renderForm(
    [{ id: 'job-1', title: 'Fix sink', customerName: 'Ana' }],
    'en',
  );
  assert.ok(
    !html.includes('data-testid="review-no-jobs-notice"'),
    'no notice when an eligible job exists',
  );
  const submit = submitButtonTag(html);
  assert.ok(submit, 'expected a submit button');
  assert.ok(!submit.includes('disabled'), `submit must be enabled, got: ${submit}`);
});
