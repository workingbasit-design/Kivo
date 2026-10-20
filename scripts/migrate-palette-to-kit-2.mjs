#!/usr/bin/env node
/**
 * FIX-NOW Session 2: second palette pass — migrate the remaining Tailwind
 * default palette utilities to the kit token set.
 *
 * Why: Part 1's script (migrate-to-kit-tokens.mjs) only walked *.tsx and
 * skipped `dark:`-prefixed tokens, leaving ~450 palette hits behind
 * (text-lime-700, border-rose-200/red-200/amber-200, text-amber-800,
 * text-indigo-600, emerald/zinc indicator palettes, …). This pass covers
 * *.ts too, maps the leftover shades, and migrates dark: variants with a
 * dedicated dark mapping (dark zinc -> dark ink-2 is near-identical).
 *
 * Safety: exact token match with variant-prefix support (hover:, focus:,
 * dark:, …) and the `!` important modifier; opacity suffixes (/10, /25)
 * are preserved. Unshaded `text-white`/`bg-white` on dark surfaces are
 * intentionally NOT touched (correct behaviour, no kit white token).
 * `ej-glass-card` (light-only glass) -> kit card classes.
 *
 * Run once: node scripts/migrate-palette-to-kit-2.mjs
 * Then: review the diff, run lint/tsc/tests/build.
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

// Paired replacements first (order matters: pairs before singles).
const PAIRS = [
  // Star ratings: amber fill + amber text -> kit star token together.
  ['fill-amber-400 text-amber-400', 'fill-star text-star'],
  ['text-amber-400 fill-amber-400', 'text-star fill-star'],
  // Light-only glass card -> kit card shell (radius/padding stay on the element).
  ['ej-glass-card', 'bg-surface border border-line shadow-kit-card'],
];

const MAPPINGS = [
  // ---- Part 1 leftovers (*.ts files were never walked) ----
  ['bg-white', 'bg-surface'],
  ['bg-zinc-50', 'bg-surface-2'],
  ['bg-zinc-100', 'bg-surface-2'],
  ['bg-zinc-200', 'bg-line'],
  ['bg-zinc-900', 'bg-asphalt'],
  ['bg-black', 'bg-asphalt'],
  ['bg-concrete', 'bg-bg'],
  ['text-zinc-900', 'text-ink'],
  ['text-zinc-800', 'text-ink'],
  ['text-zinc-700', 'text-ink'],
  ['text-zinc-600', 'text-ink-2'],
  ['text-zinc-500', 'text-ink-2'],
  ['text-zinc-400', 'text-ink-2'],
  ['text-black', 'text-ink'],
  ['border-zinc-100', 'border-line'],
  ['border-zinc-200', 'border-line'],
  ['border-zinc-300', 'border-line-strong'],
  ['divide-zinc-100', 'divide-line'],
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

  // ---- Neutrals (Session 2) ----
  ['text-zinc-200', 'text-ink-2'],
  ['text-zinc-300', 'text-ink-2'],
  ['text-gray-600', 'text-ink-2'],
  ['border-zinc-50', 'border-line'],
  ['border-zinc-400', 'border-line-strong'],
  ['border-zinc-500', 'border-line-strong'],
  ['border-zinc-900', 'border-line-strong'],
  ['ring-zinc-900', 'ring-ink'],
  ['bg-zinc-300', 'bg-line'],
  ['bg-zinc-400', 'bg-line'],
  ['bg-zinc-700', 'bg-asphalt'],
  ['from-zinc-100', 'from-surface-2'],
  ['to-zinc-200', 'to-line'],

  // ---- Sky (weather surfaces) -> info family ----
  ['bg-sky-50', 'bg-info-bg'],
  ['bg-sky-200', 'bg-info-bg'],
  ['bg-sky-500', 'bg-info'],
  ['bg-sky-600', 'bg-info'],
  ['bg-sky-700', 'bg-info'],
  ['text-sky-400', 'text-info'],
  ['text-sky-500', 'text-info'],
  ['text-sky-600', 'text-info'],
  ['text-sky-700', 'text-info'],
  ['border-sky-100', 'border-line'],
  ['border-sky-200', 'border-line'],
  ['border-sky-500', 'border-line'],
  ['from-sky-50', 'from-info-bg'],

  // ---- Violet / purple / gray / misc leftovers ----
  ['bg-violet-500', 'bg-info'],
  ['text-violet-600', 'text-info'],
  ['bg-purple-100', 'bg-info-bg'],
  ['text-purple-700', 'text-info'],
  ['bg-gray-100', 'bg-surface-2'],
  ['text-gray-800', 'text-ink'],
  ['bg-green-100', 'bg-ok-bg'],
  ['text-indigo-500', 'text-info'],
  ['text-rose-400', 'text-danger'],
  ['text-rose-800', 'text-danger'],
  ['accent-zinc-900', 'accent-ink'],
  ['bg-orange-50', 'bg-warn-bg'],
  ['text-orange-700', 'text-warn-text'],
  ['border-orange-200', 'border-warn-line'],
  ['to-zinc-50', 'to-line'],
  ['to-zinc-100', 'to-line'],
  ['to-indigo-500', 'to-hivis'],
  ['to-indigo-50', 'to-info-bg'],
  ['to-emerald-500', 'to-ok'],
  ['to-blue-500', 'to-info'],
  ['to-amber-500', 'to-warn'],

  // ---- Lime (brand accent) -> hivis family ----
  // Lime text on light surfaces was never the hi-vis treatment (lime is a
  // fill behind dark text); neutralise to ink. Lime fills -> hivis.
  ['text-lime-600', 'text-ink'],
  ['text-lime-700', 'text-ink'],
  ['text-lime-800', 'text-hivis-ink'],
  ['bg-lime-100', 'bg-hivis-soft'],
  ['bg-lime-500', 'bg-hivis'],
  ['border-lime-500', 'border-hivis'],
  ['ring-lime-500', 'ring-hivis'],
  ['outline-lime', 'outline-hivis'],

  // ---- Indigo (legacy primary/info) ----
  ['bg-indigo-50', 'bg-info-bg'],
  ['text-indigo-400', 'text-info'],
  ['text-indigo-600', 'text-info'],
  ['text-indigo-700', 'text-info'],
  ['text-violet-700', 'text-info'],
  ['text-blue-800', 'text-info'],
  ['bg-blue-100', 'bg-info-bg'],
  ['border-indigo-100', 'border-line'],
  ['border-indigo-200', 'border-line'],
  ['border-indigo-500', 'border-line'],
  ['ring-indigo-500', 'ring-focus'],
  ['bg-indigo-500', 'bg-hivis'],
  ['bg-indigo-600', 'bg-hivis'],
  ['bg-indigo-700', 'bg-hivis'],
  ['shadow-indigo-600', 'shadow-hivis'],

  // ---- Danger ----
  ['bg-rose-100', 'bg-danger-bg'],
  ['bg-red-100', 'bg-danger-bg'],
  ['bg-rose-600', 'bg-danger'],
  ['bg-rose-700', 'bg-danger'],
  ['bg-red-400', 'bg-danger'],
  ['bg-red-500', 'bg-danger'],
  ['text-rose-500', 'text-danger'],
  ['text-red-800', 'text-danger'],
  ['border-rose-200', 'border-line'],
  ['border-red-200', 'border-line'],
  ['border-red-300', 'border-line'],
  ['border-red-400', 'border-danger'],
  ['shadow-red-500', 'shadow-danger'],

  // ---- Warning ----
  ['bg-amber-100', 'bg-warn-bg'],
  ['bg-amber-500', 'bg-warn'],
  ['text-amber-400', 'text-warn-text'],
  ['text-amber-500', 'text-warn-text'],
  ['text-amber-800', 'text-warn-text'],
  ['text-amber-950', 'text-warn-text'],
  ['border-amber-200', 'border-warn-line'],
  ['fill-amber-400', 'fill-star'],

  // ---- Success ----
  ['bg-emerald-100', 'bg-ok-bg'],
  ['bg-emerald-500', 'bg-ok'],
  ['bg-emerald-600', 'bg-ok'],
  ['bg-emerald-700', 'bg-ok'],
  ['text-emerald-800', 'text-ok'],
  ['border-emerald-200', 'border-line'],
  ['border-emerald-400', 'border-ok'],
];

// dark:-prefixed variants get their own near-identical mapping (Part 1
// skipped these as "hand-tuned"; the values below are visually equivalent).
const DARK_MAPPINGS = [
  ['dark:text-zinc-200', 'dark:text-ink-2'],
  ['dark:text-zinc-300', 'dark:text-ink-2'],
  ['dark:text-zinc-400', 'dark:text-ink-2'],
  ['dark:text-zinc-500', 'dark:text-ink-2'],
  ['dark:border-zinc-600', 'dark:border-line-strong'],
  ['dark:bg-zinc-300', 'dark:bg-ink-2'],
];

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { walk(p, out); continue; }
    if (/\.(tsx|ts)$/.test(e) && !/\.test\./.test(e)) out.push(p);
  }
  return out;
}

// Match the utility with any variant prefixes (hover:, dark:, …) and an
// optional leading `!` (important). Opacity suffixes (/10) are preserved
// by the negative lookahead.
function replaceToken(s, from, to) {
  const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    '((?:!?[a-zA-Z0-9-]+:)*!?)?' + esc + '(?![\\w-])',
    'g'
  );
  return s.replace(re, (m, prefix) => (prefix || '') + to);
}

let filesChanged = 0;
let replacements = 0;
for (const file of walk(SRC)) {
  // Kit is already token-native; the old libraries are being deleted.
  if (file.includes('/components/kit/')) continue;
  if (file.includes('/components/design/')) continue;
  if (file === join(SRC, 'components/ui.tsx')) continue;
  if (file === join(SRC, 'components/customer/ui.tsx')) continue;
  let s = readFileSync(file, 'utf8');
  const before = s;
  for (const [from, to] of PAIRS) {
    const n = s.split(from).length - 1;
    if (n > 0) { s = s.split(from).join(to); replacements += n; }
  }
  for (const [from, to] of MAPPINGS) {
    const next = replaceToken(s, from, to);
    if (next !== s) { replacements++; s = next; }
  }
  for (const [from, to] of DARK_MAPPINGS) {
    const n = s.split(from).length - 1;
    if (n > 0) { s = s.split(from).join(to); replacements += n; }
  }
  if (s !== before) {
    writeFileSync(file, s);
    filesChanged++;
    console.log('migrated', relative(ROOT, file));
  }
}
console.log(`done: ${filesChanged} files, ${replacements} replacements`);
