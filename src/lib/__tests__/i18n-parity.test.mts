/**
 * i18n key-parity test: every key in the English dictionary must exist in
 * the French dictionary (recursively). Catches untranslated UI strings.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import en from '../i18n/en.ts';
import fr from '../i18n/fr.ts';

function keysOf(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') out.push(...keysOf(v as Record<string, unknown>, path));
    else out.push(path);
  }
  return out;
}

function getPath(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj;
  for (const p of path.split('.')) {
    if (cur && typeof cur === 'object' && p in cur) cur = (cur as Record<string, unknown>)[p];
    else return undefined;
  }
  return cur;
}

test('fr dictionary has every en key', () => {
  const missing = keysOf(en as Record<string, unknown>).filter(
    (k) => typeof getPath(fr as unknown as Record<string, unknown>, k) !== 'string'
  );
  assert.deepEqual(missing, [], `missing fr keys: ${missing.join(', ')}`);
});

test('en dictionary has every fr key (no orphans)', () => {
  const orphans = keysOf(fr as unknown as Record<string, unknown>).filter(
    (k) => typeof getPath(en as Record<string, unknown>, k) !== 'string'
  );
  assert.deepEqual(orphans, [], `orphan fr keys: ${orphans.join(', ')}`);
});
