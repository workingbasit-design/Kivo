#!/usr/bin/env node
/**
 * Part 1 (all-modules redesign): one-time migration of Tailwind's default
 * palette classes to the dual-valued mockup token set.
 *
 * Why: text-ink / bg-ink are now dual-valued (flip in dark mode). Any surface
 * left on bg-white / bg-zinc-* would pair a flipping text colour with a
 * light-only background in dark mode. Migrating neutrals + semantic colours
 * to dual tokens fixes the "half in dark mode" bug class everywhere at once.
 *
 * Safety: any utility token that already carries a `dark:` variant is left
 * untouched (those were hand-tuned, e.g. bg-white dark:bg-coal, and the
 * migration would be a no-op or a regression there).
 *
 * Run once: node scripts/migrate-to-kit-tokens.mjs
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

const MAPPINGS = [
  // Neutral surfaces -> dual tokens
  ['bg-white', 'bg-surface'],
  ['bg-zinc-50', 'bg-surface-2'],
  ['bg-zinc-100', 'bg-surface-2'],
  ['bg-zinc-200', 'bg-line'],
  ['bg-zinc-900', 'bg-asphalt'],
  ['bg-black', 'bg-asphalt'],
  ['bg-concrete', 'bg-bg'],
  // Neutral text -> dual tokens
  ['text-zinc-900', 'text-ink'],
  ['text-zinc-800', 'text-ink'],
  ['text-zinc-700', 'text-ink'],
  ['text-zinc-600', 'text-ink-2'],
  ['text-zinc-500', 'text-ink-2'],
  ['text-zinc-400', 'text-ink-2'],
  ['text-black', 'text-ink'],
  // Neutral borders/dividers -> dual tokens
  ['border-zinc-100', 'border-line'],
  ['border-zinc-200', 'border-line'],
  ['border-zinc-300', 'border-line-strong'],
  ['divide-zinc-100', 'divide-line'],
  // Semantic colours -> dual tokens
  ['bg-rose-50', 'bg-danger-bg'],
  ['bg-red-50', 'bg-danger-bg'],
  ['text-rose-600', 'text-danger'],
  ['text-rose-700', 'text-danger'],
  ['text-red-600', 'text-danger'],
  ['text-red-700', 'text-danger'],
  ['bg-emerald-50', 'bg-ok-bg'],
  ['bg-green-50', 'bg-ok-bg'],
  ['text-emerald-600', 'text-ok'],
  ['text-emerald-700', 'text-ok'],
  ['text-green-600', 'text-ok'],
  ['text-green-700', 'text-ok'],
  ['bg-amber-50', 'bg-warn-bg'],
  ['bg-yellow-50', 'bg-warn-bg'],
  ['text-amber-600', 'text-warn-text'],
  ['text-amber-700', 'text-warn-text'],
  ['text-yellow-600', 'text-warn-text'],
  ['text-yellow-700', 'text-warn-text'],
  ['bg-blue-50', 'bg-info-bg'],
  ['text-blue-600', 'text-info'],
  ['text-blue-700', 'text-info'],
];

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { walk(p, out); continue; }
    if (/\.tsx$/.test(e) && !/\.test\./.test(e)) out.push(p);
  }
  return out;
}

let filesChanged = 0;
let replacements = 0;
for (const file of walk(SRC)) {
  // The kit itself is already token-native.
  if (file.includes('/components/kit/')) continue;
  let s = readFileSync(file, 'utf8');
  let changed = false;
  for (const [from, to] of MAPPINGS) {
    // Match the utility with any variant prefixes (hover:, sm:, ...), but
    // never when a dark: variant is present on the same token.
    const re = new RegExp(`((?:[a-zA-Z0-9-]+:)*)${from}(?![\\w-])`, 'g');
    s = s.replace(re, (m, prefix) => {
      if (prefix.includes('dark:')) return m;
      changed = true;
      replacements++;
      return prefix + to;
    });
  }
  if (changed) {
    writeFileSync(file, s);
    filesChanged++;
  }
}
console.log(`migrated ${replacements} utilities in ${filesChanged} files`);
