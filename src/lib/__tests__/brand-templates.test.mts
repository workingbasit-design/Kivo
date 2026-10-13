/**
 * Tests for the brand-kit social templates (src/lib/brand-templates.ts).
 * Pure functions — no DB, no network.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSocialTemplates,
  parseBrandColors,
  parseBrandServices,
  type BrandInfo,
} from '../brand-templates.ts';

function baseBrand(over: Partial<BrandInfo> = {}): BrandInfo {
  return {
    name: 'Maple Plumbing',
    tagline: 'Plumbing done right, the first time',
    services: ['Drain cleaning', 'Water heaters', 'Leak repair'],
    phone: '416-555-0123',
    ...over,
  };
}

test('returns 4 templates in English', () => {
  const out = buildSocialTemplates(baseBrand(), 'en');
  assert.equal(out.length, 4);
  assert.deepEqual(
    out.map((t) => t.id),
    ['announcement', 'seasonal', 'review', 'referral']
  );
  assert.equal(out[0].title, 'New-service announcement');
});

test('returns 4 templates in French', () => {
  const out = buildSocialTemplates(baseBrand(), 'fr');
  assert.equal(out.length, 4);
  assert.equal(out[0].title, 'Annonce de service');
  assert.ok(out[0].body.includes('Maple Plumbing'));
});

test('templates include tagline, services and phone', () => {
  const [tpl] = buildSocialTemplates(baseBrand(), 'en');
  assert.ok(tpl.body.includes('Plumbing done right, the first time'));
  assert.ok(tpl.body.includes('Drain cleaning'));
  assert.ok(tpl.body.includes('416-555-0123'));
});

test('French templates use French labels', () => {
  const [tpl] = buildSocialTemplates(baseBrand(), 'fr');
  assert.ok(tpl.body.includes('Nos services :'));
  assert.ok(tpl.body.includes('Appelez-nous :'));
});

test('missing fields are omitted, never rendered as null', () => {
  const [tpl] = buildSocialTemplates(
    baseBrand({ tagline: null, services: [], phone: null }),
    'en'
  );
  assert.ok(!tpl.body.includes('null'));
  assert.ok(!tpl.body.includes('Our services:'));
  assert.ok(!tpl.body.includes('Call us:'));
});

test('blank business name falls back safely', () => {
  const [tpl] = buildSocialTemplates(baseBrand({ name: '   ' }), 'en');
  assert.ok(tpl.body.includes('Our business'));
  const [fr] = buildSocialTemplates(baseBrand({ name: '' }), 'fr');
  assert.ok(fr.body.includes('Notre entreprise'));
});

test('parseBrandColors: valid JSON passes through', () => {
  assert.deepEqual(
    parseBrandColors(JSON.stringify({ primary: '#112233', accent: '#aabbcc' })),
    { primary: '#112233', accent: '#aabbcc' }
  );
});

test('parseBrandColors: bad input falls back to defaults', () => {
  const d = { primary: '#3f6212', accent: '#a3e635' };
  assert.deepEqual(parseBrandColors(null), d);
  assert.deepEqual(parseBrandColors('not json'), d);
  assert.deepEqual(
    parseBrandColors(JSON.stringify({ primary: 'red', accent: '#12345' })),
    d
  );
});

test('parseBrandServices: valid array passes through', () => {
  assert.deepEqual(
    parseBrandServices(JSON.stringify(['A', 'B'])),
    ['A', 'B']
  );
});

test('parseBrandServices: bad input returns empty array', () => {
  assert.deepEqual(parseBrandServices(null), []);
  assert.deepEqual(parseBrandServices('nope'), []);
  assert.deepEqual(parseBrandServices(JSON.stringify({ a: 1 })), []);
  assert.deepEqual(parseBrandServices(JSON.stringify(['A', 42, null])), ['A']);
});
