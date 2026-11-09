/**
 * Dark-mode digest defects (user report 2026-11-09, two phone screenshots):
 * 1. Hero greeting rendered near-black on the dark card (contrast 1.09:1).
 * 2. Briefing "Deliver at" hour/minute selects clipped mid-character
 *    (6px of text space for "7 AM" / "00").
 * 3. No bottom-nav tab read as active on /digest (covered by the
 *    isTabActive tests in nav-logic.test.mts).
 * Each test fails on the pre-fix code: the hero classes are absent, the
 * TimeField min-widths are absent, the settings grid is two-column on
 * phones, and the working-hours row does not wrap.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (rel: string) => readFileSync(`${root}${rel}`, 'utf8');

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(hexA: string, hexB: string): number {
  const la = luminance(hexToRgb(hexA));
  const lb = luminance(hexToRgb(hexB));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

describe('digest hero dark mode', () => {
  const page = read('src/app/(app)/digest/page.tsx');

  it('greeting h1 flips to the mode-aware ink token in dark mode', () => {
    const h1 = page.match(/<h1 className="([^"]*)"/);
    assert.ok(h1, 'h1 not found in digest page');
    assert.match(h1[1], /dark:text-ink\b/);
  });

  it('hero date and body text flip to the mode-aware muted token', () => {
    const matches = page.match(/text-ej-muted dark:text-ink-2/g) ?? [];
    assert.ok(matches.length >= 2, `expected date + body muted text, found ${matches.length}`);
  });

  it('hero border uses the mode-aware line token in dark mode', () => {
    assert.match(page, /border-ej-smoke dark:border-line/);
  });

  it('sun chip is solid lime with a dark glyph (not translucent lime)', () => {
    assert.match(page, /bg-hivis text-hivis-ink/);
    assert.doesNotMatch(page, /bg-ej-lime\/40/);
  });

  it('dark ink on dark surface meets 4.5:1, while the old fixed ink token does not', () => {
    const kit = read('docs/design/everyjob-kit.css');
    const darkBlock = kit.slice(kit.indexOf('@media (prefers-color-scheme: dark)'));
    const darkInk = darkBlock.match(/--ink:#([0-9A-Fa-f]{6})/)?.[1];
    const darkSurface = darkBlock.match(/--surface:#([0-9A-Fa-f]{6})/)?.[1];
    assert.ok(darkInk && darkSurface, 'dark tokens not found in kit css');
    assert.ok(
      contrast(darkInk, darkSurface) >= 4.5,
      `dark ink #${darkInk} on dark surface #${darkSurface} is ${contrast(darkInk, darkSurface).toFixed(2)}:1`,
    );
    // The bug class: the fixed --color-ej-ink token is near-black, so a
    // hero that uses it without a dark: override is invisible in dark mode.
    const tokens = read('src/app/tokens.css');
    const fixedInk = tokens.match(/--color-ej-ink:\s*#([0-9A-Fa-f]{6})/)?.[1];
    assert.ok(fixedInk, 'fixed ej-ink token not found');
    assert.ok(
      contrast(fixedInk, darkSurface) < 4.5,
      `fixed ink #${fixedInk} on dark surface should fail contrast (got ${contrast(fixedInk, darkSurface).toFixed(2)}:1)`,
    );
    // And the light hero stays fine: fixed ink on white.
    assert.ok(contrast(fixedInk, 'FFFFFF') >= 4.5);
  });
});

describe('TimeField select widths', () => {
  // Measured on production at 16px system font: longest hour label
  // "12 AM" = 47.2px, longest minute label "59" = 18.3px; the kit select
  // reserves 14px left + 44px right (chevron) = 58px of chrome.
  const HOUR_MIN = Math.ceil(47.2 + 58); // 106
  const MINUTE_MIN = Math.ceil(18.3 + 58); // 77

  it('hour and minute selects have min-widths covering their longest labels', () => {
    const src = read('src/components/TimeField.tsx');
    const widths = [...src.matchAll(/min-w-\[(\d+)px\]/g)].map((m) => Number(m[1]));
    assert.equal(widths.length, 2, `expected hour + minute min-widths, found ${widths}`);
    const [hour, minute] = widths;
    assert.ok(hour >= HOUR_MIN, `hour min-width ${hour}px < ${HOUR_MIN}px needed`);
    assert.ok(minute >= MINUTE_MIN, `minute min-width ${minute}px < ${MINUTE_MIN}px needed`);
  });

  it('min-widths sit on plain wrapper spans, not on the kit Select label', () => {
    const src = read('src/components/TimeField.tsx');
    // The kit .field label sets min-width:0 in unlayered CSS, which beats
    // the layered Tailwind utility — with the class on the label the
    // computed min-width was 0px on production (2026-11-09) and the
    // /settings working-hours selects still clipped at 91px wide.
    // Every min-w line must be a plain <span> wrapper, never a Select prop.
    const lines = src.split('\n').filter((l) => l.includes('min-w-['));
    assert.equal(lines.length, 2, `expected two min-width lines, found ${lines.length}`);
    for (const line of lines) {
      assert.match(line, /<span className="min-w-\[\d+px\] flex-1">/);
    }
    const wrappers = [...src.matchAll(/<span className="min-w-\[(\d+)px\] flex-1">/g)].map(
      (m) => Number(m[1]),
    );
    assert.equal(wrappers.length, 2, `expected two min-width wrappers, found ${wrappers}`);
    assert.ok(wrappers[0] >= HOUR_MIN, `hour wrapper ${wrappers[0]}px < ${HOUR_MIN}px needed`);
    assert.ok(wrappers[1] >= MINUTE_MIN, `minute wrapper ${wrappers[1]}px < ${MINUTE_MIN}px needed`);
  });

  it('digest briefing settings stack to one column on phones', () => {
    const src = read('src/components/DigestSettingsForm.tsx');
    assert.match(src, /grid-cols-1/);
    assert.match(src, /sm:grid-cols-2/);
  });

  it('working-hours time rows wrap so the close time drops below on phones', () => {
    const src = read('src/components/SettingsForm.tsx');
    assert.match(src, /flex flex-wrap items-center gap-2 mt-1\.5/);
  });
});
