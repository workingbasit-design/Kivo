/**
 * FIX-NOW Session 2 — readability test.
 *
 * Fails when text is hard to read (WCAG 2.1 contrast), or when a big light
 * block appears in dark mode.
 *
 * Deliberately does NOT use @axe-core/playwright (forbidden dependency):
 * the WCAG 2.1 relative-luminance + contrast-ratio math is implemented
 * inline below, and the dark-mode light-block scan follows the luminance
 * approach from docs/PROMPT-FIX-NOW.md.
 *
 * Run:  npx playwright test -c playwright.readability.config.ts
 * Env:  KIT_BASE_URL (default http://127.0.0.1:3100)
 * Auth: tests/.auth/owner.json (signed-in owner storageState)
 */
import { test } from '@playwright/test';
import { enableLocalhostBridge } from './local-bridge';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROUTES = [
  '/dashboard',
  '/jobs',
  '/schedule',
  '/money',
  '/invoices/new',
  '/quotes/new',
  '/customers',
  '/leads',
  '/expenses',
  '/projects',
  '/equipment',
  '/settings',
];

const SCHEMES = ['light', 'dark'] as const;

interface ContrastViolation {
  selector: string;
  text: string;
  fg: string;
  bg: string;
  ratio: number;
  required: number;
  fontSizePx: number;
  fontWeight: string;
}

interface ContrastResult {
  violations: ContrastViolation[];
  checked: number;
  skippedImageBg: number;
}

/**
 * Runs entirely in the browser (passed to page.evaluate — must stay
 * self-contained, no outer-scope references).
 *
 * For every visible text node: resolve the foreground colour, walk up to the
 * first ancestor with an opaque background, composite semi-transparent text
 * over it, and compute the WCAG 2.1 contrast ratio. Normal text must reach
 * 4.5:1; large text (>=18pt, or >=14pt bold) must reach 3:1.
 */
function runContrastCheck(): ContrastResult {
  type RGB = [number, number, number];
  type RGBA = [number, number, number, number];

  const parseColor = (c: string): RGBA | null => {
    const m = c.match(
      /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?\s*\)/,
    );
    if (!m) return null;
    return [
      parseFloat(m[1]),
      parseFloat(m[2]),
      parseFloat(m[3]),
      m[4] === undefined ? 1 : parseFloat(m[4]),
    ];
  };

  // WCAG 2.1 relative luminance.
  const luminance = (r: number, g: number, b: number): number => {
    const lin = (v: number): number => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };

  const ratio = (l1: number, l2: number): number => {
    const hi = Math.max(l1, l2);
    const lo = Math.min(l1, l2);
    return (hi + 0.05) / (lo + 0.05);
  };

  const compositeOver = (fg: RGBA, bg: RGB): RGB => {
    const a = Math.min(1, Math.max(0, fg[3]));
    return [
      fg[0] * a + bg[0] * (1 - a),
      fg[1] * a + bg[1] * (1 - a),
      fg[2] * a + bg[2] * (1 - a),
    ];
  };

  const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  // Fallback when no opaque ancestor exists (transparent root): kit tokens.
  const fallbackBg: RGB = isDark ? [29, 32, 36] : [255, 255, 255]; // asphalt / white

  const effectiveBg = (el: Element): { bg: RGB } | { imageBg: true } => {
    let node: Element | null = el;
    while (node) {
      const cs = getComputedStyle(node);
      const bgImg = cs.backgroundImage;
      if (bgImg && bgImg !== 'none') return { imageBg: true }; // gradient/photo: cannot compute
      const p = parseColor(cs.backgroundColor);
      if (p && p[3] >= 0.99) return { bg: [p[0], p[1], p[2]] };
      node = node.parentElement;
    }
    return { bg: fallbackBg };
  };

  const isVisible = (el: Element): boolean => {
    let node: Element | null = el;
    while (node) {
      const cs = getComputedStyle(node);
      if (cs.display === 'none') return false;
      if (cs.visibility === 'hidden' || cs.visibility === 'collapse') return false;
      if (parseFloat(cs.opacity || '1') < 0.05) return false;
      node = node.parentElement;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const selectorOf = (el: Element): string => {
    const parts: string[] = [];
    let node: Element | null = el;
    while (node && node !== document.body && parts.length < 4) {
      let part = node.tagName.toLowerCase();
      if (node.id) {
        parts.unshift(part + '#' + node.id);
        break;
      }
      const cls =
        typeof node.className === 'string'
          ? node.className.trim().split(/\s+/).slice(0, 2).join('.')
          : '';
      if (cls) part += '.' + cls;
      let idx = 1;
      let sib = node.previousElementSibling;
      while (sib) {
        if (sib.tagName === node.tagName) idx += 1;
        sib = sib.previousElementSibling;
      }
      part += ':nth-of-type(' + idx + ')';
      parts.unshift(part);
      node = node.parentElement;
    }
    return parts.join(' > ').slice(0, 180);
  };

  const violations: ContrastViolation[] = [];
  let checked = 0;
  let skippedImageBg = 0;
  const seen = new Set<Element>();

  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let tn = walker.nextNode() as Text | null;
  while (tn) {
    const raw = tn.nodeValue || '';
    const parent = tn.parentElement;
    tn = walker.nextNode() as Text | null;
    if (!raw.trim() || !parent || seen.has(parent)) continue;
    seen.add(parent);
    const tag = parent.tagName;
    if (
      tag === 'SCRIPT' ||
      tag === 'STYLE' ||
      tag === 'NOSCRIPT' ||
      tag === 'TEMPLATE' ||
      tag === 'TEXTAREA'
    )
      continue;
    if (parent.closest('[aria-hidden="true"]')) continue;
    if (!isVisible(parent)) continue;

    const cs = getComputedStyle(parent);
    const fg = parseColor(cs.color);
    if (!fg) continue;
    const bgRes = effectiveBg(parent);
    if ('imageBg' in bgRes) {
      skippedImageBg += 1;
      continue;
    }
    const fgEff = compositeOver(fg, bgRes.bg);
    const r = ratio(
      luminance(fgEff[0], fgEff[1], fgEff[2]),
      luminance(bgRes.bg[0], bgRes.bg[1], bgRes.bg[2]),
    );
    const sizePx = parseFloat(cs.fontSize) || 16;
    const w = (cs.fontWeight || '400').toLowerCase();
    const weightNum =
      w === 'bold' ? 700 : w === 'normal' ? 400 : parseInt(w, 10) || 400;
    const isLarge = sizePx >= 24 || (weightNum >= 700 && sizePx >= 18.66);
    const required = isLarge ? 3 : 4.5;
    checked += 1;
    if (r < required) {
      violations.push({
        selector: selectorOf(parent),
        text: raw.trim().slice(0, 60),
        fg: 'rgb(' + fgEff.map((v) => Math.round(v)).join(', ') + ')',
        bg: 'rgb(' + bgRes.bg.map((v) => Math.round(v)).join(', ') + ')',
        ratio: Math.round(r * 100) / 100,
        required,
        fontSizePx: Math.round(sizePx * 10) / 10,
        fontWeight: cs.fontWeight,
      });
    }
  }

  return { violations, checked, skippedImageBg };
}

/**
 * Dark-mode light-block scan — the luminance approach from
 * docs/PROMPT-FIX-NOW.md: any element >=1600px^2 whose own background
 * luminance exceeds 0.9 (IMG/VIDEO/CANVAS excluded) is a light block that
 * should not exist in dark mode.
 */
function runLightBlockScan(): string[] {
  const luminance = (c: string): number => {
    const m = c.match(/rgba?\(([^)]+)\)/);
    if (!m) return 0;
    const parts = m[1].split(',').map((s) => s.trim());
    const r = parts[0];
    const g = parts[1];
    const b = parts[2];
    const a = parts[3] === undefined ? '1' : parts[3];
    if (parseFloat(a) < 0.5) return 0;
    const lin = (v: string): number => {
      const x = parseFloat(v) / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  };
  return Array.from(document.querySelectorAll<HTMLElement>('body *'))
    .filter((el) => !['IMG', 'VIDEO', 'CANVAS'].includes(el.tagName))
    .filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width * r.height >= 1600;
    })
    .filter((el) => luminance(getComputedStyle(el).backgroundColor) > 0.9)
    .map((el) => (el.tagName + ' ' + String(el.className)).slice(0, 120));
}

for (const scheme of SCHEMES) {
  test.describe(`readability, ${scheme} mode`, () => {
    test.use({
      colorScheme: scheme,
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
      storageState: 'tests/.auth/owner.json',
    });

    for (const route of ROUTES) {
      test(`${route} [${scheme}]`, async ({ page, context }) => {
        // Sandboxed-Chromium workaround: re-issue loopback requests from Node.
        // No-op unless KIT_LOCAL_BRIDGE=1 (see playwright.readability.config.ts).
        if (process.env.KIT_LOCAL_BRIDGE === '1') {
          await enableLocalhostBridge(context);
        }

        const name = route === '/' ? 'home' : route.slice(1).replace(/\//g, '-');
        const shotPath = `test-results/kit/${scheme}-${name}.png`;

        const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
        // networkidle never fires through the sandboxed relay (persistent
        // connections); wait for load + fonts + a paint settle instead.
        await page.waitForLoadState('load');
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(2000);

        let failure: string | null = null;
        let reportData: Record<string, unknown> | null = null;
        try {
          // 0. The page must actually render — a 4xx/5xx has no readable content.
          const status = response?.status() ?? 0;
          if (status >= 400) {
            failure =
              `${route} [${scheme}]: HTTP ${status} — the page did not render, ` +
              `so readability cannot be assessed.`;
            reportData = { route, scheme, status, error: failure };
          }
          // 1. Inline WCAG 2.1 contrast check (no axe dependency).
          if (!failure) {
            const { violations, checked, skippedImageBg } =
              await page.evaluate(runContrastCheck);
            reportData = { route, scheme, status, checked, skippedImageBg, violations };
            if (violations.length > 0) {
              const sample = violations
                .slice(0, 15)
                .map(
                  (v) =>
                    `  ${v.ratio}:1 (needs ${v.required}:1) ${v.selector}\n` +
                    `    "${v.text}" fg=${v.fg} bg=${v.bg} ${v.fontSizePx}px weight=${v.fontWeight}`,
                )
                .join('\n');
              failure =
                `${route} [${scheme}]: ${violations.length} contrast violation(s) ` +
                `(checked ${checked} text elements, skipped ${skippedImageBg} on image/gradient backgrounds):\n` +
                sample;
            }
          }

          // 2. Dark-mode light-block scan.
          if (scheme === 'dark' && !failure) {
            const lightBlocks = await page.evaluate(runLightBlockScan);
            if (reportData) reportData.lightBlocks = lightBlocks;
            if (lightBlocks.length > 0) {
              failure =
                `${route} [dark]: ${lightBlocks.length} light block(s) ` +
                `(>=1600px^2, luminance > 0.9):\n` +
                lightBlocks
                  .slice(0, 15)
                  .map((b) => `  ${b}`)
                  .join('\n');
            }
          }
        } finally {
          // Screenshot is always captured, pass or fail.
          await page.screenshot({ path: shotPath, fullPage: true });
          // Write a JSON report for CI diagnostics (uploaded as artifact).
          if (reportData) {
            try {
              mkdirSync('test-results/kit', { recursive: true });
              writeFileSync(
                `test-results/kit/${scheme}-${name}.json`,
                JSON.stringify(reportData, null, 2)
              );
            } catch {}
          }
        }

        if (failure) throw new Error(failure);
      });
    }
  });
}
