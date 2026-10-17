#!/usr/bin/env node
/**
 * Design token lint (Part B, docs/DESIGN.md).
 *
 * Fails on raw hex/rgb/hsl colours in component classNames outside the
 * token definition layers (src/app/globals.css @theme, src/components/ui.tsx
 * button classes). Colours must come from docs/DESIGN.md tokens.
 *
 * Grandfathered baseline: 20 pre-existing violations (2026-10-17). New
 * violations fail CI. Burn down the baseline over time; do not add to it.
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = new URL('..', import.meta.url).pathname;
const SRC = join(ROOT, 'src');

// Token layers: raw colours are allowed here (they ARE the definitions).
const ALLOWLIST = new Set([
  'src/app/globals.css',
  'src/components/ui.tsx',
]);

// Grandfathered pre-existing violations (file:line). Do not add new entries.
const BASELINE = new Set([
  'src/app/q/[token]/page.tsx:260',
  'src/app/i/[token]/page.tsx:246',
  'src/app/p/[slug]/page.tsx:256',
  'src/app/start/page.tsx:17',
  'src/components/FinishSetupModal.tsx:95',
  'src/components/FinishSetupModal.tsx:98',
  'src/components/NotificationSettingsForm.tsx:59',
  'src/components/WhatsAppButton.tsx:34',
  'src/components/home/ScheduleMock.tsx:35',
  'src/components/home/ScheduleMock.tsx:36',
  'src/components/home/ScheduleMock.tsx:37',
  'src/components/DispatcherMap.tsx:68',
  'src/components/GlobalCopilotWidget.tsx:1390',
  'src/components/GlobalCopilotWidget.tsx:1472',
  'src/components/PortalLinkManager.tsx:158',
  'src/components/animated-icons/lottie-lite.ts:301',
  'src/components/home/HeroBackdrop.tsx:44',
  'src/components/mascot/JobiMascot.tsx:282',
  'src/components/mascot/JobiMascot.tsx:315',
  'src/components/mascot/JobiMascot.tsx:324',
  'src/components/mascot/JobiMascot.tsx:344',
]);

// Matches Tailwind arbitrary hex: [#fff], [#ffffff], [#ffffffff]
// and rgb()/hsl() in class strings.
const HEX_RE = /\[#(?:[0-9a-fA-F]{3,8})\]/g;
const FUNC_RE = /\b(?:rgb|rgba|hsl|hsla)\(/g;

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
  if (ALLOWLIST.has(rel)) continue;
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    // Skip comments and SVG presentation attributes (separate concern).
    const code = line.replace(/\/\/.*$/, '');
    if (/^\s*(\*|\/\*)/.test(code)) return;
    HEX_RE.lastIndex = 0;
    FUNC_RE.lastIndex = 0;
    if (HEX_RE.test(code) || FUNC_RE.test(code)) {
      const key = `${rel}:${i + 1}`;
      if (!BASELINE.has(key)) {
        violations.push(`${key}: ${code.trim().slice(0, 100)}`);
      }
    }
  });
}

if (violations.length) {
  console.error('design-tokens: raw colours outside token layers:\n');
  for (const v of violations) console.error('  ' + v);
  console.error(`\n${violations.length} new violation(s). Use docs/DESIGN.md tokens (bg-ej-*, text-ej-*, border-ej-*).`);
  process.exit(1);
}
console.log('design-tokens: OK (no new violations)');
