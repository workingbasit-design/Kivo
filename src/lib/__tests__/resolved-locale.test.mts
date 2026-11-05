/**
 * FR hydration #418 (2026-11-05 tester deep test): client components using
 * useResolvedT (e.g. the /customers/new and /jobs/new forms) rendered in
 * ENGLISH during SSR while the client hydrated them in FRENCH, because
 * useResolvedLocale read the `kivo-locale` cookie in a lazy useState
 * initializer (document exists during hydration, not during SSR) while the
 * (app) tree had no <LocaleProvider> above it, so the context fell back
 * to 'en'. Every translated string mismatched (React error #418, text).
 *
 * Fix: (app)/layout.tsx wraps children in <LocaleProvider locale={locale}>
 * (same pattern as (auth)/layout.tsx), and useResolvedLocale reads the
 * cookie only in an effect, so the first client render always matches SSR.
 *
 * Plain node --test cannot parse TSX, so this test pre-compiles the real
 * LanguageToggle + useResolvedLocale sources with the TypeScript compiler
 * API (already a dev dependency) into src/lib/__tests__/resolved-build/,
 * rewrites the `@/` specifiers to real files, and renders a probe with
 * react-dom/server. The build directory is removed in an after() hook.
 *
 * Asserts (SSR output via renderToStaticMarkup, which never runs effects):
 *   1. With <LocaleProvider locale="fr">, the probe renders the FRENCH
 *      label - the provider value, i.e. the server-resolved locale,
 *      determines the SSR output (what the layout fix relies on).
 *   2. With <LocaleProvider locale="en">, it renders the ENGLISH label.
 *   3. Without a provider, it renders the ENGLISH fallback deterministically
 *      (no cookie read during SSR - the old mismatch source).
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs \
 *      src/lib/__tests__/resolved-locale.test.mts
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
const BUILD = path.join(HERE, 'resolved-build');

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
compile('components/LanguageToggle.tsx', 'LanguageToggle.mjs', [
  ['@/lib/i18n', '../../i18n/index.ts'],
]);
compile('hooks/useResolvedLocale.ts', 'useResolvedLocale.mjs', [
  ['@/components/LanguageToggle', './LanguageToggle.mjs'],
  ['@/lib/i18n', '../../i18n/index.ts'],
]);

after(() => {
  rmSync(BUILD, { recursive: true, force: true });
});

const { createElement } = await import('react');
const { renderToStaticMarkup } = await import('react-dom/server');
const { LocaleProvider } = await import(
  pathToFileURL(path.join(BUILD, 'LanguageToggle.mjs')).href
);
const { useResolvedT } = await import(
  pathToFileURL(path.join(BUILD, 'useResolvedLocale.mjs')).href
);

function Probe() {
  const { t } = useResolvedT();
  return createElement('h1', null, t('t10money.custNewTitle'));
}

test('resolved locale: provider fr renders French during SSR', () => {
  const html = renderToStaticMarkup(
    createElement(LocaleProvider, { locale: 'fr' }, createElement(Probe))
  );
  assert.match(html, /Ajouter un client/);
  assert.doesNotMatch(html, /Add customer/);
});

test('resolved locale: provider en renders English during SSR', () => {
  const html = renderToStaticMarkup(
    createElement(LocaleProvider, { locale: 'en' }, createElement(Probe))
  );
  assert.match(html, /Add customer/);
  assert.doesNotMatch(html, /Ajouter un client/);
});

test('resolved locale: no provider falls back to English deterministically', () => {
  const html = renderToStaticMarkup(createElement(Probe));
  assert.match(html, /Add customer/);
  assert.doesNotMatch(html, /Ajouter un client/);
});

/**
 * Defect 3 (same run, live-verified after Defect 2): the #418 on /jobs/new
 * was NOT the hook — it was JobForm's own copy of the lazy-cookie pattern
 * (`useState(() => resolveLocale(prop))` reading document.cookie), plus the
 * same pattern in RecurringForm and DashboardSetupCard's useCookieLocale.
 * The /jobs/new page also never passed its server-resolved locale down.
 * All three components now resolve through the SSR-safe useResolvedLocale
 * hook (useSyncExternalStore, server snapshot = context locale), and the
 * /jobs/new + /recurring pages pass their server locale as a prop.
 * This test pins the pattern so a future copy-paste of the cookie read
 * cannot silently reintroduce the FR #418.
 */
test('resolved locale: forms use the SSR-safe hook, no lazy cookie read', () => {
  const jobForm = readFileSync(path.join(SRC, 'components/JobForm.tsx'), 'utf8');
  const recurringForm = readFileSync(path.join(SRC, 'components/RecurringForm.tsx'), 'utf8');
  const setupCard = readFileSync(path.join(SRC, 'components/DashboardSetupCard.tsx'), 'utf8');
  for (const [name, src] of [['JobForm', jobForm], ['RecurringForm', recurringForm], ['DashboardSetupCard', setupCard]]) {
    assert.match(src, /useResolvedLocale/, `${name} must resolve locale via useResolvedLocale`);
    assert.doesNotMatch(src, /useState<Locale>\(\(\) =>/, `${name} must not read the locale in a lazy useState initializer (SSR 'en' vs hydrated 'fr' = #418)`);
    assert.doesNotMatch(src, /document\.cookie\.match/, `${name} must not read document.cookie for the locale at render time`);
  }
  assert.doesNotMatch(jobForm, /function resolveLocale/, 'JobForm must not keep its own cookie-based resolveLocale');
  assert.doesNotMatch(recurringForm, /function resolveLocale/, 'RecurringForm must not keep its own cookie-based resolveLocale');
  assert.doesNotMatch(setupCard, /useCookieLocale/, 'DashboardSetupCard must not keep useCookieLocale');
  const jobsNew = readFileSync(path.join(SRC, 'app/(app)/jobs/new/page.tsx'), 'utf8');
  assert.match(jobsNew, /<JobForm[^>]*locale=\{locale\}/, '/jobs/new must pass its server-resolved locale to JobForm');
  const recurringNew = readFileSync(path.join(SRC, 'app/(app)/recurring/new/page.tsx'), 'utf8');
  assert.match(recurringNew, /locale=\{locale\}/, '/recurring/new must pass its server-resolved locale to RecurringForm');
});
