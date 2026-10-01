/**
 * Spreadsheet formula-injection guard tests (OWASP "CSV Injection").
 *
 * A cell value starting with `=`, `+`, `-`, `@` (or tab/CR) becomes a live
 * formula when a CSV/XLSX export is opened in Excel/Sheets. Every export
 * path must neutralize the prefix while leaving numbers and ordinary
 * strings untouched.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/spreadsheet-injection.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);

const { escapeCsvCell, neutralizeFormulaPrefix } = await import('@/lib/costing.ts');

test('neutralizeFormulaPrefix: dangerous prefixes get the text-marker quote', () => {
  assert.equal(neutralizeFormulaPrefix('=HYPERLINK("https://evil.example","x")'), "'=HYPERLINK(\"https://evil.example\",\"x\")");
  assert.equal(neutralizeFormulaPrefix('+cmd|/c calc'), "'+cmd|/c calc");
  assert.equal(neutralizeFormulaPrefix('-2+3'), "'-2+3");
  assert.equal(neutralizeFormulaPrefix('@SUM(1+1)'), "'@SUM(1+1)");
  assert.equal(neutralizeFormulaPrefix('\t=1+1'), "'\t=1+1");
});

test('neutralizeFormulaPrefix: safe values pass through unchanged', () => {
  assert.equal(neutralizeFormulaPrefix('Acme Plumbing'), 'Acme Plumbing');
  assert.equal(neutralizeFormulaPrefix(''), '');
  assert.equal(neutralizeFormulaPrefix('100'), '100');
  assert.equal(neutralizeFormulaPrefix(42), 42);
  assert.equal(neutralizeFormulaPrefix(null), null);
  assert.equal(neutralizeFormulaPrefix(undefined), undefined);
});

test('escapeCsvCell: injection payload is neutralized AND quoted when needed', () => {
  // Payload with a comma: must be quoted for CSV structure AND neutralized.
  const evil = '=HYPERLINK("https://evil.example","click me")';
  const cell = escapeCsvCell(evil);
  assert.ok(cell.startsWith('"'), 'still quoted for the embedded comma');
  assert.ok(cell.includes("'=HYPERLINK"), 'formula prefix neutralized inside the quotes');
  assert.ok(!cell.match(/(^|[^'])="?=/), 'no unquoted formula start remains');
});

test('escapeCsvCell: ordinary values unchanged', () => {
  assert.equal(escapeCsvCell('Acme Plumbing'), 'Acme Plumbing');
  assert.equal(escapeCsvCell('a,b'), '"a,b"');
  assert.equal(escapeCsvCell('say "hi"'), '"say ""hi"""');
  assert.equal(escapeCsvCell(99.99), '99.99');
  assert.equal(escapeCsvCell(null), '');
});
