/**
 * DB-audit minors m1, m4, m5 (2026-11-11 audit, implemented 2026-11-12).
 *
 * Each test fails on the pre-fix code:
 *  m1 - Business.qstNumber was displayed on invoices but no UI ever wrote it.
 *  m4 - public service reads never filtered `active`; deleteService hard-deletes
 *       despite the schema comment claiming archived items are never hard-deleted.
 *  m5 - replaying POST /api/agent/v1/proposals with a known Idempotency-Key
 *       returned the original proposal's confirmToken to an unauthenticated caller.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { isValidQstNumber, QST_NUMBER_RE } from '../tax.ts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (rel: string) => readFileSync(`${root}${rel}`, 'utf8');
const readCode = (rel: string) =>
  read(rel).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('m1 - QST number is settable in Settings', () => {
  it('accepts a valid Revenu Québec QST number', () => {
    assert.equal(isValidQstNumber('1234567890TQ0001'), true);
    assert.equal(isValidQstNumber('1234567890tq0001'), true); // case-insensitive
    assert.equal(isValidQstNumber('  1234567890TQ0001  '), true); // surrounding spaces
    assert.equal(QST_NUMBER_RE.test('1234567890TQ0001'), true);
  });

  it('rejects anything that is not a QST number', () => {
    assert.equal(isValidQstNumber(''), false);
    assert.equal(isValidQstNumber('123456789RT0001'), false); // GST format, not QST
    assert.equal(isValidQstNumber('1234567890TQ001'), false); // too short
    assert.equal(isValidQstNumber('12345678901TQ0001'), false); // too long
    assert.equal(isValidQstNumber('1234567890TX0001'), false); // wrong letters
    assert.equal(isValidQstNumber('1234567890TQ000A'), false);
  });

  it('the settings action validates, parses and persists qstNumber', () => {
    const action = readCode('src/app/actions/settings.ts');
    assert.match(action, /qstNumber: z/);
    assert.match(action, /isValidQstNumber/);
    assert.match(action, /qstNumber: formData\.get\('qstNumber'\)/);
    assert.match(action, /qstNumber: qstNumber \? qstNumber\.toUpperCase\(\) : null/);
  });

  it('the settings page selects it and the form renders the field', () => {
    const page = readCode('src/app/(app)/settings/page.tsx');
    assert.match(page, /qstNumber: true/);
    assert.match(page, /qstNumber: business\.qstNumber/);
    const form = readCode('src/components/SettingsForm.tsx');
    assert.match(form, /qstNumber: string/);
    assert.match(form, /name="qstNumber"/);
    assert.match(form, /maxLength=\{16\}/);
  });

  it('EN + FR labels exist for the field', () => {
    const i18n = read('src/lib/i18n/fragments/track10-misc.ts');
    assert.match(i18n, /qstLabel: 'QST number'/);
    assert.match(i18n, /qstHint: 'Your Revenu Québec number/);
    assert.match(i18n, /qstLabel: 'Numéro de TVQ'/);
    assert.match(i18n, /qstHint: 'Votre numéro de Revenu Québec/);
  });
});

describe('m4 - public service reads filter active services', () => {
  it('public pro profile lists only active services (+ similar-pros match)', () => {
    const code = readCode('src/app/p/[slug]/page.tsx');
    assert.match(code, /service\.findMany\(\{\s*where: \{ businessId, active: true \}/);
    assert.match(code, /services: \{ select: \{ name: true \}, where: \{ active: true \}/);
  });

  it('agent search only matches active services', () => {
    const code = readCode('src/app/api/agent/v1/search/route.ts');
    assert.match(
      code,
      /services: \{ select: \{ name: true, priceCents: true \}, where: \{ active: true \}/
    );
  });

  it('agent pro profile only lists active services', () => {
    const code = readCode('src/app/api/agent/v1/pros/[slug]/route.ts');
    assert.match(code, /where: \{ businessId: b\.id, active: true \}/);
  });

  it('copilot service lookup only offers active services', () => {
    const code = readCode('src/app/api/copilot/route.ts');
    assert.match(code, /service\.findMany\(\{\s*where: \{ businessId, active: true \}/);
  });

  it('the schema comment no longer claims services are never hard-deleted', () => {
    const schema = read('prisma/schema.prisma');
    assert.ok(
      !/never hard-deleted by UI/.test(schema),
      'the old comment contradicted deleteService, which hard-deletes'
    );
    assert.match(schema, /public reads filter active:true/);
  });
});

describe('m5 - proposal replay never returns the confirm token', () => {
  it('the deduplicated replay carries no token or confirmation URL', () => {
    const code = readCode('src/app/api/agent/v1/proposals/route.ts');
    assert.match(code, /deduplicated: true/);
    assert.ok(
      !/existing\.confirmToken/.test(code),
      'replay must not touch the original confirm token at all'
    );
    // The only `confirmationUrl:` key in the file is the 201 create response.
    assert.equal((code.match(/confirmationUrl:/g) ?? []).length, 1);
    assert.match(code, /confirmationUrl: `\$\{origin\}\/a\/\$\{confirmToken\}`/);
  });
});
