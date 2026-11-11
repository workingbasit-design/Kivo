/**
 * Design audit findings D1-D8 (2026-11-11).
 *
 * The root cause behind most of these: src/app/tokens.css defined a parallel
 * single-valued palette that did not flip in dark mode. The fix is to use the
 * kit's dual-valued tokens, so the regressions these guard against are
 * "a non-flipping token used where the surface flips" and vice versa.
 *
 * Contrast maths is inline (WCAG 2.1 relative luminance) - no new dependency.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (rel: string) => readFileSync(`${root}${rel}`, 'utf8');
const kit = read('docs/design/everyjob-kit.css');
const tokens = read('src/app/tokens.css');

function lin(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(a: string, b: string): number {
  const [la, lb] = [luminance(a), luminance(b)];
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Read a kit token's value in light or dark mode. */
function token(name: string, mode: 'light' | 'dark'): string {
  const darkStart = kit.indexOf('@media (prefers-color-scheme: dark)');
  const block = mode === 'light' ? kit.slice(0, darkStart) : kit.slice(darkStart);
  const m = block.match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  if (m) return m[1];
  // Not redefined for dark: the token holds one value in both modes.
  const light = kit.slice(0, darkStart).match(new RegExp(`--${name}:\\s*(#[0-9A-Fa-f]{6})`));
  assert.ok(light, `token --${name} not found in the kit`);
  return light![1];
}

describe('D1 - job-ops primary button is readable in both modes', () => {
  const src = read('src/components/jobops-classes.ts');

  it('sits on the mode-stable dark fill, not on --ink', () => {
    // --ink flips to near-white in dark mode while --hero-ink is near-white
    // in BOTH, so bg-ink + text-hero-ink was a blank white pill.
    assert.match(src, /jPrimaryBtnClass =\s*\n?\s*'bg-asphalt /);
    assert.ok(!/bg-ink hover/.test(src), 'must not fill with --ink');
  });

  it('measures well above AA in dark mode', () => {
    const fg = token('hero-ink', 'dark');
    const bg = token('asphalt', 'dark');
    assert.ok(contrast(fg, bg) >= 4.5, `${fg} on ${bg} = ${contrast(fg, bg).toFixed(2)}:1`);
    // and the old pairing really was the reported failure
    assert.ok(contrast(token('hero-ink', 'dark'), token('ink', 'dark')) < 1.2);
  });
});

describe('D2 - no frozen secondary-text token', () => {
  it('--color-graphite aliases the kit --ink-2', () => {
    assert.match(tokens, /--color-graphite:\s*var\(--ink-2\)/);
    assert.ok(
      !/--color-graphite:\s*#[0-9A-Fa-f]{3,8}/.test(tokens),
      'graphite must never be a frozen hex again',
    );
  });

  it('the resolved colour passes AA on the card surface in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const r = contrast(token('ink-2', mode), token('surface', mode));
      assert.ok(r >= 4.5, `${mode}: ${r.toFixed(2)}:1`);
    }
  });
});

describe('D3 - Collected panel uses the hero ink pair', () => {
  const src = read('src/components/dashboard/CollectedCard.tsx');

  it('has no page-level ink tokens left on the dark panel', () => {
    assert.ok(!/\btext-ink-2\b/.test(src), 'text-ink-2 is 3.14:1 on the hero panel');
    assert.match(src, /text-hero-ink-2/);
  });

  it('the hero ink pair passes AA on the hero fill in both modes', () => {
    for (const mode of ['light', 'dark'] as const) {
      const r = contrast(token('hero-ink-2', mode), token('hero', mode));
      assert.ok(r >= 4.5, `${mode}: ${r.toFixed(2)}:1`);
    }
  });
});

describe('D4 - notification badge count', () => {
  it('both badges use a token that flips against the danger fill', () => {
    for (const f of ['src/components/MobileNav.tsx', 'src/components/AppSidebar.tsx']) {
      const src = read(f);
      assert.ok(
        !/bg-signal[^"]*text-hero-ink/.test(src),
        `${f}: text-hero-ink is near-white in BOTH modes, 2.77:1 on the dark salmon`,
      );
      assert.match(src, /bg-signal[^"]*text-surface/, `${f} must use text-surface`);
    }
  });

  it('the kit badge class no longer hardcodes white', () => {
    assert.match(kit, /\.badge\{[^}]*color:var\(--surface\)/);
  });

  it('passes AA in dark mode, where it used to fail', () => {
    const dark = contrast(token('surface', 'dark'), token('danger', 'dark'));
    const light = contrast(token('surface', 'light'), token('danger', 'light'));
    assert.ok(dark >= 4.5, `dark: ${dark.toFixed(2)}:1`);
    assert.ok(light >= 4.5, `light: ${light.toFixed(2)}:1`);
    // the old pairing was the reported 2.77:1
    assert.ok(contrast(token('hero-ink', 'dark'), token('danger', 'dark')) < 3);
  });
});

describe('D5 - settings logo placeholder icon', () => {
  it('uses muted ink, not a border token', () => {
    const src = read('src/components/LogoUploadCard.tsx');
    assert.ok(!/ImagePlus[^/]*text-line-strong/.test(src), 'line-strong is 1.61:1 on white');
    assert.match(src, /ImagePlus size=\{28\} className="text-ink-2"/);
  });
});

describe('D6/D7 - polish', () => {
  it('the WhatsApp deep green carries white text at AA', () => {
    const m = tokens.match(/--color-wa-deep:\s*(#[0-9A-Fa-f]{6})/);
    assert.ok(m, 'wa-deep not found');
    const r = contrast('#FFFFFF', m![1]);
    assert.ok(r >= 4.5, `white on ${m![1]} = ${r.toFixed(2)}:1`);
  });

  it('the landing ghost numerals clear the large-text threshold', () => {
    const page = read('src/app/page.tsx');
    assert.match(page, /text-\[64px\][^"]*text-steel/);
    // 64px decorative numerals: WCAG large-text bar is 3:1.
    const r = contrast(token('steel', 'light'), token('bg', 'light'));
    assert.ok(r >= 3, `steel on white = ${r.toFixed(2)}:1`);
  });
});

describe('D8 - the parallel palette is gone, not just aliased', () => {
  it('no ej-* colour token is defined any more', () => {
    assert.ok(
      !/--color-ej-[a-z-]+:/.test(tokens),
      'the ej-* palette must be deleted so nobody can reach for it again',
    );
  });

  it('no ej-* colour utility survives in any component', () => {
    // The colour gates do not catch these: ej-muted is not a Tailwind palette
    // name and carries no hex, so only a name scan finds it.
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) { walk(full); continue; }
        if (!/\.(tsx|ts)$/.test(entry.name) || /\.test\./.test(entry.name)) continue;
        const src = readFileSync(full, 'utf8');
        for (const m of src.matchAll(
          /\b(?:bg|text|border|ring|divide|placeholder|outline|fill|stroke)-ej-[a-z-]+/g,
        )) {
          hits.push(`${relative(root, full)}: ${m[0]}`);
        }
      }
    };
    walk(join(root, 'src'));
    assert.deepEqual(hits, [], `ej-* utilities still in use:\n${hits.join('\n')}`);
  });

  it('the surviving legacy aliases all point at kit vars', () => {
    for (const name of ['paper', 'smoke', 'graphite', 'concrete', 'zinc-400', 'signal', 'pine', 'safety-ink', 'night', 'coal', 'soot']) {
      const m = tokens.match(new RegExp(`--color-${name}:\\s*([^;]+);`));
      assert.ok(m, `--color-${name} not found`);
      assert.match(m![1].trim(), /^var\(--[a-z0-9-]+\)$/, `--color-${name} must alias a kit var`);
    }
  });
});
