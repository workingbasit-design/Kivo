/**
 * Part 1 (all-modules redesign): dark-mode token test.
 *
 * Loads the /design showcase (every kit component in every state) in dark
 * mode and fails if any kit surface — card, input, chip, banner, sheet, row,
 * button — has a computed background that is not a dark token. This is the
 * regression test for the "half in dark mode" bug: hard-coded light colours
 * can never sneak back in, because CI runs this suite.
 *
 * Dark values are copied from the kit tokens (docs/design/everyjob-kit.css).
 * If you change a dark token there, update DARK_TOKENS here.
 */
import { test, expect, loginAs } from './fixtures';

// Every background a kit component may legitimately have in dark mode.
const DARK_TOKENS = new Set(
  [
    '#0b0b0c', // bg, nav, hivis-ink, asphalt (always-dark surfaces)
    '#161618', // surface
    '#1e1e21', // surface-2, hero-2
    '#2a2a2e', // line
    '#3d3d44', // line-strong
    '#c6f432', // hivis
    '#e5faa3', // hivis-soft
    '#e8590c', // warn
    '#2e2117', // warn-bg
    '#5a3a22', // warn-line
    '#331b1a', // danger-bg
    '#f06a5f', // danger
    '#16291e', // ok-bg
    '#5fd28c', // ok
    '#1a2433', // info-bg
    '#8ab4ff', // info
    '#141416', // hero
    '#f4f5f2', // hero-ink
    '#2e2e33', // hero-line
    '#eef0f2', // toast-bg, chart-a
    '#6e767e', // chart-b
    '#2c8c9e', // biz
    '#fbbf24', // star
    '#25d366', // wa (brand)
    '#1fb857', // wa-dark (brand)
  ].map((h) => h.toLowerCase())
);

test.describe('P1 dark-mode tokens', () => {
  test('P1-DM-001: /design in dark mode — every kit surface uses a dark token', async ({
    page,
    context,
  }) => {
    await loginAs(page, 'ownerA');
    // Force dark mode before paint: the theme script reads this same key.
    await context.addInitScript(() => localStorage.setItem('ej-theme', 'dark'));
    await page.goto('/design');
    await page.waitForLoadState('networkidle').catch(() => {});
    expect(page.url()).toContain('/design');

    const dark = await page.evaluate(() =>
      document.documentElement.classList.contains('dark')
    );
    expect(dark).toBe(true);

    // Every kit component marks its surface with data-kit (see KIT-CONVENTIONS.md).
    const count = await page.locator('[data-kit]').count();
    expect(count).toBeGreaterThan(20);

    const bad: string[] = await page.evaluate(
      ({ tokens }) => {
        const allowed = new Set(tokens);
        const problems: string[] = [];
        const els = Array.from(
          document.querySelectorAll('[data-kit], [data-kit] input, [data-kit] textarea, [data-kit] select, [data-kit] button')
        );
        for (const el of els) {
          const bg = getComputedStyle(el).backgroundColor;
          const m = bg.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
          if (!m) continue;
          const alpha = m[4] === undefined ? 1 : parseFloat(m[4]);
          if (alpha === 0) continue; // transparent
          const hexOf = (n: string) => Number(n).toString(16).padStart(2, '0');
          const hex = `#${hexOf(m[1])}${hexOf(m[2])}${hexOf(m[3])}`.toLowerCase();
          if (!allowed.has(hex)) {
            const kit = (el as HTMLElement).dataset.kit ?? el.tagName.toLowerCase();
            const label = el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 40) || '';
            problems.push(`${kit} <${el.tagName.toLowerCase()}> ${bg} "${label}"`);
          }
        }
        return problems;
      },
      { tokens: [...DARK_TOKENS] }
    );

    expect(bad, `non-dark backgrounds in dark mode:\n${bad.join('\n')}`).toEqual([]);
  });
});
