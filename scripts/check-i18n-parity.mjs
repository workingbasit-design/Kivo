#!/usr/bin/env node
/**
 * i18n parity check (Part D).
 *
 * Loads the merged en + fr dictionaries (base + fragments, exactly as the
 * app resolves them) and fails if any key is missing in either language or
 * empty in either language. Keys identical in both languages are reported
 * as warnings only — most are legitimate cognates ("Total", "Service"),
 * brand names ("WhatsApp"), or placeholders ("{count} jobs").
 *
 * Usage (CI uses Node 22, which needs the flag):
 *   node --experimental-strip-types scripts/check-i18n-parity.mjs
 * On Node >= 22.18 / 24 the flag is a harmless no-op.
 */
import { getDictionary } from '../src/lib/i18n/index.ts';

function flatten(obj, prefix = '') {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      Object.assign(out, flatten(v, path));
    } else {
      out[path] = v;
    }
  }
  return out;
}

const en = flatten(getDictionary('en'));
const fr = flatten(getDictionary('fr'));

const missingInFr = Object.keys(en).filter((k) => !(k in fr));
const missingInEn = Object.keys(fr).filter((k) => !(k in en));
const emptyEn = Object.keys(en).filter(
  (k) => typeof en[k] === 'string' && en[k].trim() === '',
);
const emptyFr = Object.keys(fr).filter(
  (k) => typeof fr[k] === 'string' && fr[k].trim() === '',
);
const identical = Object.keys(fr).filter(
  (k) => k in en && en[k] === fr[k] && typeof fr[k] === 'string',
);

console.log(`en keys: ${Object.keys(en).length}, fr keys: ${Object.keys(fr).length}`);

let failed = false;
const report = (title, keys, sample) => {
  if (keys.length === 0) return;
  failed = true;
  console.error(`\nFAIL: ${title} (${keys.length})`);
  for (const k of keys.slice(0, sample)) console.error(`  ${k} => ${JSON.stringify(en[k] ?? fr[k])}`);
  if (keys.length > sample) console.error(`  ... and ${keys.length - sample} more`);
};

report('keys missing in fr', missingInFr, 50);
report('keys missing in en', missingInEn, 50);
report('empty en strings', emptyEn, 20);
report('empty fr strings', emptyFr, 20);

if (identical.length > 0) {
  console.log(
    `\nWARN: ${identical.length} fr strings identical to en (cognates / brands / placeholders — review manually):`,
  );
  for (const k of identical.slice(0, 20)) console.log(`  ${k} => ${JSON.stringify(fr[k])}`);
  if (identical.length > 20) console.log(`  ... and ${identical.length - 20} more`);
}

if (failed) {
  console.error('\ni18n parity check FAILED');
  process.exit(1);
}
console.log('\ni18n parity check PASSED');
