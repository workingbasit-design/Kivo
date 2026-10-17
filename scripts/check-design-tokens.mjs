#!/usr/bin/env node
/**
 * Design token lint (Part B, docs/DESIGN.md).
 *
 * Fails on raw hex/rgb/hsl colours in component classNames outside the
 * token definition layers (src/app/globals.css @theme, src/components/ui.tsx
 * button classes). Colours must come from docs/DESIGN.md tokens.
 *
 * Grandfathered baseline: pre-existing violations (recorded 2026-10-17).
 * Keyed by file+colour (not file:line) so adding lines above a violation
 * does not false-positive as "new" (CI incident 2026-10-17: Part E8 shifted
 * lines after the baseline was recorded). New (file, colour) pairs fail CI.
 * Burn down the baseline over time; do not add to it.
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

// Grandfathered pre-existing violations (file|colour). Do not add new entries.
const BASELINE = new Set([
  'src/app/i/[token]/page.tsx|[#1fb857]',
  'src/app/i/[token]/page.tsx|[#25d366]',
  'src/app/p/[slug]/page.tsx|[#1a9449]',
  'src/app/p/[slug]/page.tsx|[#1faa55]',
  'src/app/q/[token]/page.tsx|[#1fb857]',
  'src/app/q/[token]/page.tsx|[#25d366]',
  'src/app/start/page.tsx|[#f4f4f2]',
  'src/components/DispatcherMap.tsx|rgba(0,0,0,.35)',
  'src/components/FinishSetupModal.tsx|[#ff7a59]',
  'src/components/GlobalCopilotWidget.tsx|[#fbfbfd]',
  'src/components/NotificationSettingsForm.tsx|[#161616]',
  'src/components/PortalLinkManager.tsx|[#128c4a]',
  'src/components/PortalLinkManager.tsx|[#25d366]',
  'src/components/WhatsAppButton.tsx|[#128c4a]',
  'src/components/WhatsAppButton.tsx|[#25d366]',
  'src/components/animated-icons/lottie-lite.ts|rgba(${math.round(rr * 255)',
  'src/components/home/HeroBackdrop.tsx|rgba(250,250,247,0.7)',
  'src/components/home/ScheduleMock.tsx|[#28c840]',
  'src/components/home/ScheduleMock.tsx|[#febc2e]',
  'src/components/home/ScheduleMock.tsx|[#ff5f57]',
  'src/components/mascot/JobiMascot.tsx|rgba(0,0,0,0.12)',
  'src/components/mascot/JobiMascot.tsx|rgba(0,0,0,0.15)',
  'src/components/mascot/JobiMascot.tsx|rgba(0,0,0,0.2)',
  'src/components/mascot/JobiMascot.tsx|rgba(0,0,0,0.25)',
]);

// Colour signatures are extracted inline below via matchAll.

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
    // Signatures are the literal colours on the line, lower-cased. Keying on
    // (file, colour) instead of (file, line) makes the check immune to line
    // shifts from unrelated edits elsewhere in the file.
    const sigs = new Set();
    for (const m of code.matchAll(/\[#(?:[0-9a-fA-F]{3,8})\]/g)) sigs.add(m[0].toLowerCase());
    for (const m of code.matchAll(/\b(?:rgb|rgba|hsl|hsla)\([^)]*\)/g)) sigs.add(m[0].toLowerCase());
    for (const sig of sigs) {
      if (!BASELINE.has(`${rel}|${sig}`)) {
        violations.push(`${rel}:${i + 1} [${sig}]: ${code.trim().slice(0, 90)}`);
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
