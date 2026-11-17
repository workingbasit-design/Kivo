/**
 * P1.0 E2b: no new inline locale ternaries.
 *
 * UI copy must go through t() + a dictionary key (EN/FR parity is enforced
 * by i18n-parity.test.mts). A locale ternary with string-literal branches
 * bypasses the dictionary: the French copy lives only in the call site,
 * invisible to the parity test and to translators.
 *
 * The detector is line-based and deliberately narrow: it flags a ternary
 * only when the FIRST branch is a string/template literal (not an
 * identifier, property access, or call) and it is not a bare locale tag
 * ('fr-CA' / 'en-CA' / 'fr' / 'en' / 'h23' / 'h12'). That is exactly the
 * shape of the 87 UI ternaries E2 migrated; the remaining class-(b) lines
 * (locale-tag selectors, structured {en, fr} data selection, locale
 * formatting rules, message-template stores, demo values) do not match
 * it and need no allowlist entry.
 *
 * The 12 allowlisted lines below are the class-(b) string-literal
 * ternaries that DO match the detector and are legitimate as-is:
 * relative-time formatting, message-template stores, copilot reply
 * builders, and kit Showcase demo values. Each entry is `file ::
 * normalized line`; the test fails on any NEW suspicious line AND on
 * any allowlist entry that no longer matches a live line (stale) —
 * removing a ternary means removing its entry in the same commit.
 *
 * Two-arg helpers are also forbidden: tr('en', 'fr') / t('en', 'fr')
 * with two string args. The single-arg alias tr('key') =
 * (path) => t(locale, path) is fine and is not matched.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO = join(import.meta.dirname, '..', '..', '..');
const SRC = join(REPO, 'src');

// file :: normalized line (trimmed, whitespace collapsed)
const ALLOWLIST = new Set<string>([
  "src/app/(app)/notifications/page.tsx :: if (mins < 60) return locale === 'fr' ? `il y a ${mins} min` : `${mins}m ago`;",
  "src/app/(app)/notifications/page.tsx :: if (hours < 24) return locale === 'fr' ? `il y a ${hours} h` : `${hours}h ago`;",
  "src/components/NotificationBell.tsx :: if (mins < 60) return locale === 'fr' ? `il y a ${mins} min` : `${mins}m ago`;",
  "src/components/NotificationBell.tsx :: if (hours < 24) return locale === 'fr' ? `il y a ${hours} h` : `${hours}h ago`;",
  "src/components/kit/Showcase.tsx :: value: lang === 'fr' ? '1 240 $' : '$1,240',",
  'src/lib/brand-templates.ts :: return locale === \'fr\' ? `\\nAppelez-nous : ${phone}` : `\\nCall us: ${phone}`;',
  "src/lib/brand-templates.ts :: const name = brand.name?.trim() || (locale === 'fr' ? 'Notre entreprise' : 'Our business');",
  "src/lib/copilot/engine.ts :: lang === 'fr' ? 'dû' : 'due'",
  'src/lib/copilot/engine.ts :: const more = total > 10 ? (lang === \'fr\' ? `\\n\\n...et ${total - 10} de plus.` : `\\n\\n...and ${total - 10} more.`) : \'\';',
  "src/lib/messaging/templates.ts :: const invoice = (p.invoiceNumber ?? '').trim() || (locale === 'fr' ? 'votre facture' : 'your invoice');",
  "src/lib/messaging/templates.ts :: const quote = (p.quoteNumber ?? '').trim() || (locale === 'fr' ? 'votre devis' : 'your quote');",
  "src/lib/reminders.ts :: return locale === 'fr' ? `${datePart} à ${clock}` : `${datePart} at ${clock}`;",
]);

const LOCALE_TAG = /^['"](fr-CA|en-CA|fr|en|h23|h12)['"]$/;
const LITERAL_START = /^['"`]/;
// locale === 'fr' ? / lang === 'fr' ? / bare fr ? / en ? — the quote is NOT
// consumed, so the tail starts at the first branch literal.
const TERNARY_START = /(?:locale|lang)\s*===\s*['"]fr['"]\s*\?|\bfr\s*\?|\ben\s*\?/g;
// Two string args: tr('en', 'fr') / t('en', 'fr'). The single-arg alias
// tr('key') has no comma + second string, so it never matches.
const TWO_ARG =
  /\b(?:tr|t)\(\s*(?:'[^']*'|"[^"]*")\s*,\s*(?:'[^']*'|"[^"]*")/;

function walkSrc(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      if (entry !== '__tests__') walkSrc(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

function normalize(line: string): string {
  return line.trim().replace(/\s+/g, ' ');
}

/** True when the line holds a string-literal-branch locale ternary. */
function isSuspicious(line: string): boolean {
  let m: RegExpExecArray | null;
  TERNARY_START.lastIndex = 0;
  while ((m = TERNARY_START.exec(line)) !== null) {
    const tail = line.slice(m.index + m[0].length);
    const colon = tail.indexOf(':');
    if (colon < 0) continue;
    const branch1 = tail.slice(0, colon).trim();
    if (!LITERAL_START.test(branch1)) continue;
    if (LOCALE_TAG.test(branch1)) continue;
    if (!/['"`]/.test(tail.slice(colon + 1))) continue;
    return true;
  }
  return false;
}

test('no new inline locale ternaries outside the allowlist', () => {
  const found = new Set<string>();
  const unlisted: string[] = [];
  for (const file of walkSrc(SRC)) {
    const rel = relative(REPO, file);
    const lines = readFileSync(file, 'utf8').split('\n');
    for (const line of lines) {
      if (!isSuspicious(line)) continue;
      const key = `${rel} :: ${normalize(line)}`;
      found.add(key);
      if (!ALLOWLIST.has(key)) unlisted.push(key);
    }
  }
  assert.deepEqual(
    unlisted,
    [],
    `inline locale ternaries outside the allowlist — use t() + a dictionary key:\n${unlisted.join('\n')}`
  );
  const stale = [...ALLOWLIST].filter((entry) => !found.has(entry));
  assert.deepEqual(
    stale,
    [],
    `stale allowlist entries — the ternary is gone, remove the entry:\n${stale.join('\n')}`
  );
});

test('no two-arg locale helpers tr(en, fr) / t(en, fr)', () => {
  const hits: string[] = [];
  for (const file of walkSrc(SRC)) {
    const rel = relative(REPO, file);
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      if (TWO_ARG.test(line)) hits.push(`${rel}:${i + 1}: ${normalize(line)}`);
    });
  }
  assert.deepEqual(
    hits,
    [],
    `two-arg locale helpers — use t(locale, 'key') + a dictionary key:\n${hits.join('\n')}`
  );
});
