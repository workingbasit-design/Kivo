import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const REPO_ROOT = new URL('../../../', import.meta.url);

// CI gate: scripts/check-design-tokens.mjs must pass on the current tree.
// Regression test for the 2026-10-17 CI incident: the baseline was keyed by
// file:line, so an unrelated commit (Part E8) adding lines above grandfathered
// violations made validate fail with "3 new violation(s)" that were not new.
// The baseline is now keyed by file+colour, which is line-shift-insensitive.
test('design-tokens: script passes on current tree (no new violations)', () => {
  try {
    execFileSync('node', ['scripts/check-design-tokens.mjs'], {
      cwd: REPO_ROOT,
      timeout: 120_000,
      stdio: 'pipe',
    });
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer };
    assert.fail(
      'check-design-tokens.mjs failed:\n' +
        String(e.stdout ?? '') +
        String(e.stderr ?? ''),
    );
  }
});
