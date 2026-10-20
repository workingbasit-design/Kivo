#!/usr/bin/env node
/**
 * Design token lint (Part 1, all-modules redesign).
 *
 * Fails on ANY hex / rgb / hsl colour literal in src ts/tsx files outside the
 * token definitions (src/app/tokens.css, imported by src/app/globals.css)
 * and the documented EXCEPTIONS below.
 * Colours must come from the mockup token set (docs/design/app-mockup.html):
 * bg-surface, text-ink, border-line, bg-hivis, text-warn-text, bg-danger-bg,
 * text-ok, bg-info-bg, bg-hero, bg-nav, ... or var(--token) references.
 *
 * This is the enforcement arm of "no hard-coded colours": it is what keeps
 * dark mode from ever going half-light again. Do not add exceptions without
 * a genuine reason (brand artwork, HTML email, user colour data).
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

// Token definitions: raw colours are allowed here (they ARE the tokens).
const TOKEN_FILES = new Set(['src/app/globals.css', 'src/app/tokens.css']);

// Documented exceptions: file -> reason. Keep this list short.
const EXCEPTIONS = new Map([
  ['src/lib/messaging/email-templates.ts', 'HTML email: no CSS custom properties or Tailwind.'],
  ['src/components/EveryJobLogo.tsx', 'Brand logo SVG artwork.'],
  ['src/components/GoogleSignInButton.tsx', 'Google brand SVG artwork.'],
  ['src/components/GoogleReviewsPanel.tsx', 'Google brand SVG artwork.'],
  ['src/components/home/ScheduleMock.tsx', 'macOS window-chrome mimicry (intentional).'],
  ['src/components/home/HeroVisual.tsx', 'Marketing-site SVG artwork (light-only surface).'],
  ['src/components/BrandKitForm.tsx', 'User-selectable brand palettes (data, not UI).'],
  ['src/components/CrewForm.tsx', 'User-selectable crew colours (data, not UI).'],
  ['src/app/actions/crews.ts', 'User colour data + validation regex.'],
  ['src/app/actions/brand.ts', 'User colour data + validation regex.'],
  ['src/lib/brand-templates.ts', 'Brand palette data.'],
  ['src/components/animated-icons/lottie-lite.ts', 'Animation colour math, not UI.'],
  ['src/components/PwaRegister.tsx', 'Single theme-color fallback literal.'],
]);

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { walk(p, out); continue; }
    if (/\.(tsx|ts)$/.test(e) && !/\.test\./.test(e)) out.push(p);
  }
  return out;
}

const violations = [];
for (const file of walk(SRC)) {
  const rel = relative(ROOT, file);
  if (TOKEN_FILES.has(rel) || EXCEPTIONS.has(rel)) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  let inBlock = false;
  lines.forEach((line, i) => {
    // Strip line comments, block comments (incl. multi-line {/* ... */}),
    // and block-comment-only lines.
    let code = line.replace(/\/\/.*$/, '');
    if (inBlock) {
      const end = code.indexOf('*/');
      if (end === -1) return;
      code = code.slice(end + 2);
      inBlock = false;
    }
    for (;;) {
      const start = code.indexOf('/*');
      if (start === -1) break;
      const end = code.indexOf('*/', start + 2);
      if (end === -1) { code = code.slice(0, start); inBlock = true; break; }
      code = code.slice(0, start) + code.slice(end + 2);
    }
    if (/^\s*(\*|\/\*)/.test(code)) return;
    // Remove known false positives before checking:
    // - URL fragments: href="#section", actionHref="#add"
    // - Reference numbers: 'Invoice #1042', 'Order #123'
    code = code
      .replace(/(href|to|actionHref)=["']#[A-Za-z][\w-]*["']/g, '$1=""')
      .replace(/\b(Invoice|Order|PO|Ticket|Job)\s+#\d+/gi, '$1 REF');
    const sigs = new Set();
    for (const m of code.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) sigs.add(m[0].toLowerCase());
    for (const m of code.matchAll(/\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/g)) sigs.add(m[0].toLowerCase());
    for (const sig of sigs) {
      violations.push(`${rel}:${i + 1} [${sig}]: ${code.trim().slice(0, 100)}`);
    }
  });
}

if (violations.length) {
  console.error('design-tokens: raw colours outside the token system:\n');
  for (const v of violations) console.error('  ' + v);
  console.error(
    `\n${violations.length} violation(s). Use mockup tokens (bg-surface, text-ink, ...) or var(--token).`
  );
  console.error('Genuine exceptions (brand artwork, HTML email, user colour data) go in EXCEPTIONS with a reason.');
  process.exit(1);
}
console.log('design-tokens: OK (no raw colours outside tokens)');
