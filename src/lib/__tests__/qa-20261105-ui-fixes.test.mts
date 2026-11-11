/**
 * Source-level regression locks for the 2026-11-05 exhaustive-sweep fixes
 * whose behaviour lives in client components (not unit-testable in node):
 *
 * #1 (MAJOR) CopilotDemo renders inside the intentionally-dark copilot
 *    section, so it must not use light-section text tokens (ink-2 / ok are
 *    dark gray/green — unreadable on asphalt). Hero-ink/lime stay bright.
 * #4 (MINOR) The job-detail badge text must follow live status state, not
 *    the server-rendered vm.statusLabel, or the badge lags the toast.
 * #5 (MINOR) The invoice form must surface a no-customer error in-app
 *    instead of relying on native `required` validation (silent in
 *    automation) — client guard + inline error, server backstop intact.
 * #7 (COSMETIC) No native window.confirm() in project deletes — the kit
 *    ConfirmDialog works in automated browsers and mobile webviews.
 * BONUS /money headers rendered literal backticks + ${...} because the
 *    template literals sat in JSX text without braces.
 *
 * Pattern follows client-server-boundary.test.mts (source reads).
 *
 * Run: npm test -- src/lib/__tests__/qa-20261105-ui-fixes.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(new URL(import.meta.url).pathname), '..', '..', '..');
const src = (p: string) => readFileSync(join(ROOT, 'src', p), 'utf8');

test('#1 CopilotDemo uses no light-section text tokens in the dark section', () => {
  const f = src('components/home/CopilotDemo.tsx');
  assert.ok(!/\btext-ink-2\b/.test(f), 'text-ink-2 is unreadable on asphalt');
  assert.ok(!/\btext-ok\b/.test(f), 'text-ok is unreadable on asphalt');
  // 2026-11-11: the bubbles now use the --hero-ink-2 token rather than an
  // opacity-diluted text-hero-ink/70. Same intent — the hero-ink family,
  // never a light-section token — so assert the family, not the dilution.
  assert.match(f, /\btext-hero-ink(-2)?\b/, 'bot bubbles should use the hero-ink family');
  assert.ok(!/text-hero-ink\/[0-9]+/.test(f), 'hero ink must come from a token, not an opacity dilution');
  assert.ok(f.includes('text-lime'), 'success title should use lime');
});

test('#4 job-detail badge text follows live status state', () => {
  const f = src('app/(app)/jobs/[id]/JobDetailClient.tsx');
  assert.ok(
    f.includes('jobStatusLabel(status, locale)'),
    'badge children must derive from live status, not vm.statusLabel'
  );
  assert.ok(!/children: vm\.statusLabel/.test(f), 'stale vm.statusLabel badge found');
});

test('#5 invoice form guards no-customer submit in-app', () => {
  const f = src('app/(app)/invoices/new/InvoiceForm.tsx');
  assert.ok(f.includes('invCustomerRequired'), 'missing no-customer error copy');
  assert.ok(f.includes("customerId === ''"), 'missing client-side no-customer guard');
  assert.ok(f.includes('customerError'), 'missing inline picker error state');
  assert.ok(
    !/name="customerId"\s*\n\s*required/.test(f),
    'native required on the customer select blocks submit silently'
  );
});

test('#7 project deletes use the kit dialog, never native confirm()', () => {
  for (const p of ['components/ProjectHeaderForm.tsx', 'components/ProjectPhases.tsx']) {
    const f = src(p);
    assert.ok(!/(^|[^\w])confirm\(/.test(f), `${p} still calls native confirm()`);
    assert.ok(f.includes('ConfirmDialog'), `${p} must render the kit ConfirmDialog`);
  }
});

test('BONUS /money headers interpolate instead of rendering literal backticks', () => {
  const f = src('app/(app)/money/page.tsx');
  assert.ok(!/<h3[^>]*>`\$/.test(f), 'literal backtick template found in a header');
  assert.ok(f.includes('{`${L('), 'headers must be brace-wrapped template expressions');
});
