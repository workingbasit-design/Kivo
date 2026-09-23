/**
 * SEO / AI-search honesty tests for the Track 2 (SEO + GEO) build.
 *
 * Guards the marketing surface: FAQ copy must be bilingual and complete,
 * must never name competitors or invent metrics, and the structured-data
 * plumbing (canonical, OG image, FAQPage JSON-LD, sitemap) must stay wired.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getDictionary } from '../i18n/index.ts';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const read = (p: string) => readFileSync(join(root, p), 'utf8');

const COMPETITORS = [
  'jobber', 'servicetitan', 'housecall', 'workiz', 'kickserv',
  'fieldedge', 'simpro', 'tradify', 'fergus', 'synchroteam',
];
const FAKE_METRIC = /(\d+\s*%|\bmillion\b|#1\b|best in canada)/i;

for (const locale of ['en', 'fr'] as const) {
  test(`homefaq: ${locale} has 7 complete Q&A pairs`, () => {
    const d = getDictionary(locale) as Record<string, Record<string, string>>;
    const faq = d.homefaq;
    assert.ok(faq, 'homefaq namespace missing');
    for (let n = 1; n <= 7; n++) {
      assert.equal(typeof faq[`q${n}`], 'string', `q${n} missing`);
      assert.equal(typeof faq[`a${n}`], 'string', `a${n} missing`);
      assert.ok(faq[`q${n}`].trim().length > 5, `q${n} too short`);
      assert.ok(faq[`a${n}`].trim().length > 20, `a${n} too short`);
    }
  });

  test(`homefaq: ${locale} copy names no competitors`, () => {
    const d = getDictionary(locale) as Record<string, Record<string, string>>;
    const text = Object.values(d.homefaq).join(' ').toLowerCase();
    for (const c of COMPETITORS) {
      assert.ok(!text.includes(c), `FAQ mentions competitor: ${c}`);
    }
  });

  test(`homefaq: ${locale} copy has no invented metrics or superlatives`, () => {
    const d = getDictionary(locale) as Record<string, Record<string, string>>;
    const text = Object.values(d.homefaq).join(' ');
    assert.ok(!FAKE_METRIC.test(text), `FAQ contains invented metric/claim: ${text.match(FAKE_METRIC)?.[0]}`);
  });
}

test('homepage renders a visible FAQ section and FAQPage JSON-LD', () => {
  const src = read('src/app/page.tsx');
  assert.ok(src.includes('id="faq"'), 'no #faq section anchor');
  assert.ok(src.includes('FAQPage'), 'no FAQPage JSON-LD');
  assert.ok(src.includes('mainEntity'), 'FAQPage missing mainEntity');
  // JSON-LD must be built from the same visible Q&A (no drift between the
  // two surfaces).
  assert.ok(src.includes('FAQS.map'), 'FAQPage JSON-LD not derived from visible FAQS');
});

test('layout ships canonical, keywords, OG image and fr_CA alternate locale', () => {
  const src = read('src/app/layout.tsx');
  assert.ok(src.includes('canonical'), 'missing canonical URL');
  assert.ok(src.includes('keywords'), 'missing keywords meta');
  assert.ok(src.includes('/og/og-home.png'), 'missing OG image');
  assert.ok(src.includes('fr_CA'), 'missing fr_CA alternate locale');
  assert.ok(src.includes('summary_large_image'), 'twitter card should be large image');
  assert.ok(src.includes('"CA"') || src.includes("'CA'"), 'SoftwareApplication missing areaServed CA');
});

test('og image asset exists at the referenced path', () => {
  const p = join(root, 'public/og/og-home.png');
  assert.ok(existsSync(p), 'public/og/og-home.png missing');
  assert.ok(statSync(p).size > 10_000, 'og image suspiciously small');
});

test('robots references the sitemap and sitemap lists public routes', () => {
  const robots = read('src/app/robots.ts');
  assert.ok(robots.includes('/sitemap.xml'), 'robots missing sitemap reference');
  const sitemap = read('src/app/sitemap.ts');
  assert.ok(sitemap.includes('`${SITE_URL}`') || sitemap.includes("url: SITE_URL"), 'sitemap missing homepage');
  assert.ok(sitemap.includes('/directory'), 'sitemap missing /directory');
});
