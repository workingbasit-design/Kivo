/**
 * Unit tests for the help center article library (src/lib/help-articles.ts)
 * plus en/fr parity of the support i18n fragment. No HTTP, no DB — pure
 * logic only.
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/help-articles.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HELP_CATEGORIES,
  listArticles,
  getArticleBySlug,
  articlesInCategory,
  searchArticles,
  categoryLabel,
} from '@/lib/help-articles.ts';
import fragment from '../i18n/fragments/support.ts';

function keysOf(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') out.push(...keysOf(v as Record<string, unknown>, path));
    else out.push(path);
  }
  return out;
}

test('article count is within the required range', () => {
  const n = listArticles().length;
  assert.ok(n >= 10 && n <= 14, `expected 10-14 articles, got ${n}`);
});

test('every article has non-empty EN and FR title and body', () => {
  for (const a of listArticles()) {
    assert.ok(a.en.title.trim().length > 0, `${a.slug}: empty EN title`);
    assert.ok(a.en.body.trim().length > 50, `${a.slug}: EN body too short`);
    assert.ok(a.fr.title.trim().length > 0, `${a.slug}: empty FR title`);
    assert.ok(a.fr.body.trim().length > 50, `${a.slug}: FR body too short`);
  }
});

test('slugs and ids are unique', () => {
  const slugs = listArticles().map((a) => a.slug);
  const ids = listArticles().map((a) => a.id);
  assert.equal(new Set(slugs).size, slugs.length, 'duplicate slug');
  assert.equal(new Set(ids).size, ids.length, 'duplicate id');
});

test('related links have no dead ends and no self-references', () => {
  const bySlug = new Set(listArticles().map((a) => a.slug));
  for (const a of listArticles()) {
    assert.ok(a.related.length > 0, `${a.slug}: no related articles`);
    for (const r of a.related) {
      assert.ok(bySlug.has(r), `${a.slug}: dead related link -> ${r}`);
      assert.notEqual(r, a.slug, `${a.slug}: self-referencing related link`);
    }
  }
});

test('every article category is a known category', () => {
  const known = new Set(HELP_CATEGORIES.map((c) => c.id));
  for (const a of listArticles()) {
    assert.ok(known.has(a.category), `${a.slug}: unknown category ${a.category}`);
  }
});

test('getArticleBySlug finds articles, returns undefined for unknown', () => {
  const first = listArticles()[0];
  assert.equal(getArticleBySlug(first.slug)?.id, first.id);
  assert.equal(getArticleBySlug('no-such-article'), undefined);
});

test('searchArticles matches titles and bodies in both locales', () => {
  const en = searchArticles('invoice', 'en');
  assert.ok(en.length > 0, 'expected EN hits for "invoice"');
  const fr = searchArticles('facture', 'fr');
  assert.ok(fr.length > 0, 'expected FR hits for "facture"');
  // Cross-locale isolation: a French-only term should not match in EN mode.
  const frOnly = searchArticles('plomberie', 'en');
  assert.equal(frOnly.length, 0, 'EN search matched a French-only term');
  // Empty query returns everything.
  assert.equal(searchArticles('', 'en').length, listArticles().length);
  assert.equal(searchArticles('   ', 'fr').length, listArticles().length);
});

test('articlesInCategory and categoryLabel are consistent', () => {
  for (const c of HELP_CATEGORIES) {
    const arts = articlesInCategory(c.id);
    assert.ok(arts.length > 0, `category ${c.id} has no articles`);
    assert.ok(categoryLabel(c.id, 'en').length > 0);
    assert.ok(categoryLabel(c.id, 'fr').length > 0);
  }
});

test('support fragment: fr has every en key and no orphans', () => {
  const en = fragment.en.support as unknown as Record<string, unknown>;
  const fr = fragment.fr.support as unknown as Record<string, unknown>;
  const enKeys = keysOf(en).sort();
  const frKeys = keysOf(fr).sort();
  assert.deepEqual(frKeys, enKeys, 'en/fr key mismatch in support fragment');
});

test('support fragment: every string value is non-empty in both locales', () => {
  for (const loc of ['en', 'fr'] as const) {
    const dict = (fragment[loc].support as unknown as Record<string, unknown>);
    const walk = (obj: Record<string, unknown>, path: string) => {
      for (const [k, v] of Object.entries(obj)) {
        const p = `${path}.${k}`;
        if (v && typeof v === 'object') walk(v as Record<string, unknown>, p);
        else assert.ok(typeof v === 'string' && v.length > 0, `${loc}:${p} is empty`);
      }
    };
    walk(dict, 'support');
  }
});
