/**
 * Client/server import boundary regression test.
 *
 * On 2026-09-26 the production build failed with a Turbopack panic:
 * `node:async_hooks` (imported by src/lib/tenant-guard.ts) ended up in a
 * browser chunk because two client components transitively imported
 * server-only lib modules:
 *   - LiveTrackingClient -> lib/eta -> lib/geofence -> lib/tenant-guard
 *   - NotificationSettingsForm -> lib/notifications -> lib/prisma
 *
 * Rule enforced here: no 'use client' module may reach a server-only lib
 * (prisma.ts, tenant-guard.ts, and anything that imports node: builtins)
 * through static imports UNLESS the path goes through a 'use server'
 * module (server actions are proxied by Next.js and never bundled into
 * the client).
 *
 * This test fails fast in `npm test` instead of waiting for a production
 * build to panic.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, normalize } from 'node:path';

// Resolve relative to the repo root regardless of cwd.
const ROOT = join(dirname(new URL(import.meta.url).pathname), '..', '..', '..');
const SRC = join(ROOT, 'src');

// Modules that must never appear in a browser chunk.
const DENY = new Set([
  join(SRC, 'lib', 'prisma.ts'),
  join(SRC, 'lib', 'tenant-guard.ts'),
]);

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (e === '__tests__' || e === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(ts|tsx)$/.test(e)) {
      out.push(p);
    }
  }
  return out;
}

function resolve(spec: string, basedir: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = normalize(join(basedir, spec));
  else return null; // bare package import — not our concern
  for (const c of [`${base}.ts`, `${base}.tsx`, join(base, 'index.ts'), join(base, 'index.tsx'), base]) {
    try {
      if (statSync(c).isFile()) return c;
    } catch {
      /* not found */
    }
  }
  return null;
}

const importRe = /^import\s+(?!type\b).*?from\s*['"]([^'"]+)['"]/gm;
const sideEffectRe = /^import\s*['"]([^'"]+)['"]/gm;

interface Mod {
  isClient: boolean;
  isServerAction: boolean;
  deps: string[];
}

function analyze(f: string): Mod {
  const src = readFileSync(f, 'utf8');
  const head = src.slice(0, 300);
  // Strip `import type` lines — types are erased and never bundled.
  const noTypes = src
    .split('\n')
    .filter((l) => !/^\s*import\s+type\b/.test(l))
    .join('\n');
  const deps = new Set<string>();
  for (const re of [importRe, sideEffectRe]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(noTypes))) {
      const r = resolve(m[1], dirname(f));
      if (r) deps.add(r);
    }
  }
  return {
    isClient: head.includes("'use client'"),
    isServerAction: head.includes("'use server'"),
    deps: [...deps],
  };
}

test('no client component transitively imports server-only libs', () => {
  const files = walk(SRC);
  const mods = new Map<string, Mod>();
  for (const f of files) mods.set(f, analyze(f));

  const violations: string[] = [];

  // DFS from each client module. `viaServer` becomes true once the path
  // passes through a 'use server' module (Next.js proxies those).
  function visit(f: string, viaServer: boolean, path: string[]): void {
    if (DENY.has(f) && !viaServer) {
      violations.push([...path, f].map((p) => p.replace(ROOT + '/', '')).join(' -> '));
      return;
    }
    const mod = mods.get(f);
    if (!mod) return;
    const nextVia = viaServer || mod.isServerAction;
    for (const d of mod.deps) {
      if (path.includes(d)) continue; // cycle guard
      visit(d, nextVia, [...path, f]);
    }
  }

  for (const [f, mod] of mods) {
    if (mod.isClient) visit(f, false, []);
  }

  assert.equal(
    violations.length,
    0,
    `Client components must not import server-only modules:\n${violations.join('\n')}`
  );
});
