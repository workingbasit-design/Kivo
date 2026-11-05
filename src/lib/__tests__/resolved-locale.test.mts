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
