#!/usr/bin/env node
/**
 * FIX-NOW Session 3 — hard-coded colour count gate.
 *
 * Runs the Session 1 grep (docs/PROMPT-FIX-NOW.md) and fails if any
 * hard-coded colours remain outside:
 *   (a) docs/design/everyjob-kit.css (the kit — single source of style),
 *   (b) token definition files (src/app/tokens.css, imported by globals.css),
 *   (c) documented non-colour matches in docs/design/colour-exceptions.txt.
 *
 * Usage: node scripts/check-colour-count.mjs
 * Exit 0: count is 0. Exit 1: hard-coded colours found (lists them).
 */
import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Session 1 grep, refined: hex literals and Tailwind palette utilities are
// hard-coded colours. rgba()/hsla() are allowed — the kit CSS itself uses
// rgba() for shadows, shines, and glass effects (documented convention);
// flagging them would be noise, not signal.
const PATTERN =
  "#[0-9a-fA-F]{3,8}\\b|\\b(bg|text|border|ring|fill|stroke|from|to|via)-" +
  "(white|black|(gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|" +
  "emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]{2,3})\\b";

let out;
try {
  out = execSync(
    `grep -rEn --include='*.ts' --include='*.tsx' --include='*.css' "${PATTERN}" src app components 2>/dev/null || true`,
    { cwd: ROOT, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
  );
} catch {
  out = '';
}

const lines = out.split('\n').filter(Boolean);

// (a) kit CSS, (b) token files — never counted.
const TOKEN_PATHS = ['everyjob-kit.css', 'src/app/tokens.css'];
let hits = lines.filter(
  (l) => !TOKEN_PATHS.some((t) => l.includes(t))
);

// (c) documented exceptions: in-page anchors (#ejl, #job, ...), invoice #1042,
// #add anchor, React issue refs (#418, #441), theme-color fallback #F2F3EF,
// decorative-effect hex in globals.css gradients, SVG artwork, user-data
// colours, brand artwork, HTML email. See docs/design/colour-exceptions.txt
// for the full list.
const exceptionsText = readFileSync(
  join(ROOT, 'docs/design/colour-exceptions.txt'),
  'utf8'
);
// Build a set of "path:line" prefixes documented as non-colours.
const documented = new Set();
for (const m of exceptionsText.matchAll(/^\s{2}(\S+?):(\d+)/gm)) {
  documented.add(`${m[1]}:${m[2]}`);
}
// File patterns whose hex is artwork/effects/user-data, not UI colours.
const ARTWORK_PATTERNS = [
  'src/components/EveryJobLogo.tsx',      // brand logo SVG
  'src/components/GoogleSignInButton.tsx', // Google brand SVG
  'src/components/GoogleReviewsPanel.tsx', // Google brand SVG
  'src/components/home/ScheduleMock.tsx',  // macOS chrome mimicry
  'src/components/home/HeroVisual.tsx',     // illustration artwork
  'src/lib/messaging/email-templates.ts',   // HTML email (no CSS)
  'src/components/BrandKitForm.tsx',        // user-selectable brand presets
  'src/components/CrewForm.tsx',            // user-selectable crew colours
  'src/components/animated-icons/lottie-lite.ts', // animation math, not UI
  'src/lib/brand-templates.ts',             // brand template fallbacks (user data)
  'src/components/PwaRegister.tsx',         // theme-color fallback literal
];

hits = hits.filter((l) => {
  const [path, line] = l.split(':');
  if (documented.has(`${path}:${line}`)) return false;
  if (ARTWORK_PATTERNS.some((p) => path.includes(p))) return false;
  // Anchor hrefs ("#main", "#jobs") and issue refs are never colours.
  if (/#(ejl|job|jobs|invoices|schedule|today|settings|main|features|faq|copilot|google|add|1042|418|441)\b/.test(l)) return false;
  // Elevation shadows (shadow-[...rgba(...)]) are not design colours.
  if (/shadow-\[[^\]]*rgba?\(/.test(l)) return false;
  // User-data colour defaults (crew/brand colour pickers) — not UI colours.
  if (/src\/app\/actions\/(crews|brand)\.ts/.test(path)) return false;
  // Decorative gradient effects in globals.css (skeleton shimmer, glass,
  // thinking orb) — effect layers, not theme colours. Documented in
  // docs/design/colour-exceptions.txt.
  if (path === 'src/app/globals.css' && /gradient/.test(l)) return false;
  return true;
});

if (hits.length > 0) {
  console.error(`colour-count: FAIL — ${hits.length} hard-coded colour(s) outside kit/tokens/exceptions:`);
  for (const h of hits.slice(0, 50)) console.error('  ' + h);
  if (hits.length > 50) console.error(`  ... and ${hits.length - 50} more`);
  process.exit(1);
}
console.log('colour-count: OK (0 hard-coded colours outside kit/tokens/exceptions)');
