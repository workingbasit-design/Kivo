/**
 * i18n key-parity test: every key in the English dictionary must exist in
 * the French dictionary (recursively). Catches untranslated UI strings.
 * Uses the merged dictionaries (base + fragments) so fragment strings are
 * covered too.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getDictionary } from '../i18n/index.ts';

const en = getDictionary('en');
const fr = getDictionary('fr');

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

import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { t, lookupDict, resolveWithFallback } from '../i18n/index.ts';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO = join(TEST_DIR, '..', '..', '..');

function leafEntries(
  obj: Record<string, unknown>,
  prefix = '',
  out: Array<[string, string]> = []
): Array<[string, string]> {
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      leafEntries(v as Record<string, unknown>, path, out);
    } else if (typeof v === 'string') {
      out.push([path, v]);
    }
  }
  return out;
}

function placeholderSet(value: string): Set<string> {
  return new Set([...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((m) => m[1]));
}

// P1.0 E1 test 5 allowlist: leaf keys whose FR value is byte-identical to EN
// (cognates, proper nouns, codes, placeholder-only values — verified by hand
// in the slice-C analysis). Seeded from the live merged dictionaries; a new
// identical value must be deliberately added here, not silently pass.
const IDENTICAL_ALLOWLIST: string[] = [
  'agent.confirm.service',
  // F2: 'Action' is the same word in French — a cognate, not a missing
  // translation.
  'auditLog.colAction',
  'auditLog.filterAction',
  'attention.items.jobAtRisk.detail',
  'attention.items.jobUnassigned.detail',
  'attention.severity.info',
  'billing.colDate',
  'billing.colTotal',
  'bookingF7.durationMin',
  'bookingF7.service',
  'bookkeeping.net',
  'bookkeeping.profit',
  'brand.services',
  'copilot.fieldDate',
  'copilot.fieldService',
  'credentials.formType',
  'customer.home.heroChip',
  'customer.messages.title',
  'customer.nav.messages',
  'customers.notes',
  'dashboard.durationHour',
  'dashboard.durationMin',
  'dashboard.summarySentenceNoMoney',
  'equipment.notes',
  'esign.fieldDate',
  'esign.fieldSignature',
  'expenses.date',
  'expenses.description',
  'expenses.total',
  'explainer.labelTotal',
  'exports.colDate',
  'exports.colDescription',
  'exports.colTotal',
  'exports.colType',
  'googleAuth.phonePlaceholder',
  'googleAuth.signInMethodGoogle',
  'gps.distance',
  'growth.checks.province',
  'home.canada.cardTitle',
  'home.copilot.langBadge',
  'home.mock.job1Name',
  'home.mock.job2Name',
  'home.mock.job3Name',
  'home.nav.faq',
  'home.stats.langsValue',
  'home.stats.modulesLabel',
  'home.stats.modulesValue',
  'home.stats.regionsValue',
  'imports.description',
  'imports.typeServices',
  'integrations.endpointUrlPh',
  'integrations.webhooksTitle',
  'inventory.notes',
  'inventory.sku',
  'invoices.notes',
  'invoices.total',
  'jobops.costing.profit',
  'jobops.expenses.date',
  'jobops.expenses.description',
  'jobops.profitability.profit',
  'jobs.date',
  'jobs.notes',
  'jobs.profit',
  'jobs.service',
  'jobs.sortDate',
  'messaging.whatsappUsage',
  'nav.digest',
  'nav.marketing',
  'nav.menu',
  'notifications.b_booking_new',
  'notifications.b_booking_request',
  'notifications.b_change_requested',
  'notifications.b_job_tomorrow',
  'notifications.b_lead_new',
  'notifications.b_quote_accepted',
  'notifications.b_quote_declined',
  'notifications.title',
  'payments.colDate',
  'payments.connectTitle',
  'pricebook.kindLabel',
  'projects.budget',
  'projects.phaseNameLabel',
  'properties.province',
  'quoteItems.desc',
  'quoteItems.total',
  'quotes.portal.total',
  'reminders.sms',
  'reminders.whatsapp',
  'reports.metric.total',
  'reports.total',
  'subcontractors.note',
  'support.formMessage',
  't10misc.auth.passwordPlaceholder',
  't10misc.claims.note',
  't10misc.claims.services',
  't10misc.directory.qrPhonePlaceholder',
  't10misc.marketing.message',
  't10misc.marketing.previewSampleName',
  't10misc.marketing.title',
  't10misc.pricebook.description',
  't10misc.pricebook.tradeIconAuto',
  't10misc.settingsMain.groupCommunication',
  't10misc.team.emailPlaceholder',
  't10misc.teamreport.admin',
  't10misc.voice.langFr',
  't10money.bookingFormNotes',
  't10money.custNotes',
  't10money.custProvince',
  't10money.invMode',
  't10money.invPortalTotal',
  't10money.leadSource',
  't10money.leadSrcWhatsapp',
  't10money.profileWhatsapp',
  't10money.reminders.smsLabel',
  't10money.reminders.waLabel',
  't10money.reviewTokenJobLine',
  't10money.totalLabel',
  't10work.formPhonePlaceholder',
  't10work.jobSmsLabel',
  't10work.jobWhatsAppLabel',
  't10work.recurPlansMany',
  't10work.recurPlansOne',
  'team.date',
  'team.notes',
  'team.photos',
];

test('every fragment file is registered (orphan guard)', () => {
  const dir = join(REPO, 'src', 'lib', 'i18n', 'fragments');
  const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
  assert.ok(files.length > 40, `expected many fragments, got ${files.length}`);
  const fragmentsSrc = readFileSync(join(REPO, 'src', 'lib', 'i18n', 'fragments.ts'), 'utf8');
  const arrayLiteral = fragmentsSrc.slice(fragmentsSrc.indexOf('const FRAGMENTS'));
  for (const file of files) {
    const area = file.replace(/\.ts$/, '');
    const m = fragmentsSrc.match(
      new RegExp(`import\\s+(\\w+)\\s+from\\s+'\\./fragments/${area.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.ts'`)
    );
    assert.ok(m, `${file} is imported in fragments.ts`);
    assert.ok(arrayLiteral.includes(m[1]), `${file} binding ${m[1]} is in the FRAGMENTS array`);
  }
});

test('no dictionary value is its own key path', () => {
  const dotted = /^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/;
  for (const [locale, dict] of [['en', en], ['fr', fr]] as const) {
    for (const [path, value] of leafEntries(dict as Record<string, unknown>)) {
      assert.notEqual(value, path, `${locale} ${path} value is its own key`);
      assert.ok(!dotted.test(value), `${locale} ${path} value looks like a dotted key: ${value}`);
    }
  }
});

test('fr values differ from en except for the allowlist', () => {
  const allowed = new Set(IDENTICAL_ALLOWLIST);
  const enLeaves = new Map(leafEntries(en as Record<string, unknown>));
  const frLeaves = new Map(leafEntries(fr as Record<string, unknown>));
  const unexpected: string[] = [];
  for (const [path, enValue] of enLeaves) {
    if (frLeaves.get(path) === enValue && !allowed.has(path)) unexpected.push(path);
  }
  assert.deepEqual(unexpected, [], `identical EN/FR values not in the allowlist: ${unexpected.join(', ')}`);
  const stale = [...allowed].filter((k) => enLeaves.get(k) !== frLeaves.get(k));
  assert.deepEqual(stale, [], `allowlist entries that are no longer identical: ${stale.join(', ')}`);
});

test('placeholder sets match between en and fr', () => {
  // Double-brace documentation values are excluded by exact key.
  const excluded = new Set(['t10misc.marketing.messageHint', 't10misc.marketing.messagePlaceholder']);
  const enLeaves = new Map(leafEntries(en as Record<string, unknown>));
  const frLeaves = new Map(leafEntries(fr as Record<string, unknown>));
  const bad: string[] = [];
  for (const [path, enValue] of enLeaves) {
    if (excluded.has(path)) continue;
    const frValue = frLeaves.get(path);
    if (frValue === undefined) continue;
    const enSet = placeholderSet(enValue);
    const frSet = placeholderSet(frValue);
    const diff = new Set([...enSet, ...frSet].filter((v) => !enSet.has(v) || !frSet.has(v)));
    const extra = [...diff].filter((v) => v !== 's' && v !== 'x');
    if (extra.length > 0) bad.push(`${path}: EN {${[...enSet].join(',')}} vs FR {${[...frSet].join(',')}}`);
  }
  assert.deepEqual(bad, [], `placeholder mismatches:\n${bad.join('\n')}`);
});

// --- Test 7: literal call-site resolution (vendored resolver) ---

type AliasDef = { name: string; prefix: string };

function walkSrc(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name !== '__tests__' && e.name !== 'node_modules') walkSrc(p, out);
    } else if (/\.tsx?$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

function aliasDefs(src: string): AliasDef[] {
  const defs: AliasDef[] = [];
  // const NAME = (x) => t(locale, 'prefix.' + x)  (concat form, either quote)
  const concat = /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*t\(\s*\w+\s*,\s*['"]([^'"]*)['"]\s*\+/g;
  // const NAME = (x) => t(locale, `prefix.${x}`)  (template form)
  const tmpl = /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*t\(\s*\w+\s*,\s*`([^`]*)\$\{/g;
  // const NAME = (x) => t(locale, x)  (direct alias)
  const direct = /const\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*t\(\s*\w+\s*,\s*\w+\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = concat.exec(src))) defs.push({ name: m[1], prefix: m[2] });
  while ((m = tmpl.exec(src))) defs.push({ name: m[1], prefix: m[2] });
  while ((m = direct.exec(src))) {
    if (!defs.some((d) => d.name === m![1])) defs.push({ name: m![1], prefix: '' });
  }
  return defs;
}

function extractKeys(file: string, src: string): Array<{ key: string; plural: boolean }> {
  const out: Array<{ key: string; plural: boolean }> = [];
  const lit = (q: string) => `(?:${q}([^${q}]+)${q})`;
  // t(locale, 'key') / t(locale, "key") — first arg must be an identifier
  // (a string first arg is the two-arg helper, not a dictionary call).
  const tRe = new RegExp(
    `\\bt\\(\\s*[A-Za-z_$][\\w$]*\\s*,\\s*(?:${lit("'")}|${lit('"')})\\s*(?:as\\s+never|as\\s+const)?\\s*\\)`,
    'g'
  );
  const tpRe = new RegExp(
    `\\btp\\(\\s*[A-Za-z_$][\\w$]*\\s*,\\s*(?:${lit("'")}|${lit('"')})`,
    'g'
  );
  let m: RegExpExecArray | null;
  while ((m = tRe.exec(src))) out.push({ key: m[1] ?? m[2], plural: false });
  while ((m = tpRe.exec(src))) out.push({ key: m[1] ?? m[2], plural: true });
  // Alias calls: NAME('suffix') — resolved through the file's alias defs.
  // Direct aliases (L/T/tr = (k) => t(locale, k)) use the literal as-is.
  for (const { name, prefix } of aliasDefs(src)) {
    const re = new RegExp(`\\b${name}\\(\\s*(?:'([^']+)'|"([^"]+)")\\s*\\)`, 'g');
    while ((m = re.exec(src))) {
      const litKey = m[1] ?? m[2];
      // Skip the alias DEFINITION line itself (it contains t(..., not NAME()
      // — but a self-referential def would match; guard by skipping lines
      // that define this alias).
      out.push({ key: prefix + litKey, plural: false });
    }
  }
  return out;
}

test('every literal t/tr/tp/L call site resolves in both dictionaries', () => {
  const files = walkSrc(join(REPO, 'src'));
  const missing: string[] = [];
  const pluralMissing: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, 'utf8');
    for (const { key, plural } of extractKeys(file, src)) {
      if (key.includes('${')) continue; // dynamic template — covered by the domain checks below
      const enVal = getPath(en as unknown as Record<string, unknown>, key);
      const frVal = getPath(fr as unknown as Record<string, unknown>, key);
      if (plural) {
        const ok = (v: unknown) =>
          !!v && typeof v === 'object' && typeof (v as { one?: unknown }).one === 'string';
        if (!ok(enVal) || !ok(frVal)) pluralMissing.push(`${file}: ${key}`);
      } else {
        if (typeof enVal !== 'string' || typeof frVal !== 'string') {
          missing.push(`${file}: ${key}`);
        }
      }
    }
  }
  assert.deepEqual(missing, [], `unresolvable literal keys:\n${missing.slice(0, 20).join('\n')}`);
  assert.deepEqual(pluralMissing, [], `unresolvable plural keys:\n${pluralMissing.join('\n')}`);
});

test('dynamic template families resolve for every value in their domain', () => {
  const check = (prefix: string, values: string[]) => {
    for (const v of values) {
      const key = `${prefix}.${v}`;
      assert.equal(
        typeof getPath(en as unknown as Record<string, unknown>, key),
        'string',
        `EN missing ${key}`
      );
      assert.equal(
        typeof getPath(fr as unknown as Record<string, unknown>, key),
        'string',
        `FR missing ${key}`
      );
    }
  };
  // QuoteRequest.status is a free string in the schema: sent | replied |
  // accepted | declined | completed (schema comment, QuoteRequest.status).
  check('customer.requests.status', ['sent', 'replied', 'accepted', 'declined', 'completed']);
  // Designation types (src/lib/designations.ts DESIGNATION_TYPES).
  check('credentials.types', [
    'LICENSE',
    'RED_SEAL',
    'PROVINCIAL_CERT',
    'BBB',
    'INSURANCE',
    'BONDING',
    'MANUFACTURER',
    'OTHER',
  ]);
  // Service categories (home-client SERVICES + directory MAIN/MORE lists).
  check('customer.categories', [
    'Plumbing',
    'Electrical',
    'Cleaning',
    'HVAC',
    'Handyman',
    'Painting',
    'Landscaping',
    'Roofing',
    'Pest Control',
  ]);
});

// --- Test 8: t() fallback contract ---

test('t() falls back to EN on a FR miss (resolveWithFallback contract)', () => {
  const enDict = { a: { b: 'EN value', c: 'shared' } } as unknown as Parameters<
    typeof resolveWithFallback
  >[0];
  const frDict = { a: { c: 'FR shared' } } as unknown as Parameters<typeof resolveWithFallback>[0];
  assert.equal(resolveWithFallback(frDict, enDict, 'a.b'), 'EN value');
  assert.equal(resolveWithFallback(frDict, enDict, 'a.c'), 'FR shared');
  assert.equal(resolveWithFallback(frDict, enDict, 'a.missing'), 'a.missing');
  assert.equal(lookupDict(enDict, 'a.b'), 'EN value');
  assert.equal(lookupDict(frDict, 'a.b'), undefined);
  // Neither locale: the real t() still returns the raw key (loud failure).
  assert.equal(t('fr', '__i18n_test_missing__'), '__i18n_test_missing__');
  assert.equal(t('en', '__i18n_test_missing__'), '__i18n_test_missing__');
  // A real key resolves in both locales (regression: the fallback must not
  // shadow a present FR value).
  assert.equal(t('fr', 'search.searching'), 'Recherche…');
  assert.equal(t('en', 'search.searching'), 'Searching…');
});
