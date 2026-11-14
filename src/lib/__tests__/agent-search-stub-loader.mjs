/**
 * Resolve hook for the GET /api/agent/v1/search tests (DB-audit m7).
 *
 * Redirects framework/data modules to the in-memory stub, and resolves
 * extensionless relative imports (`./phone` -> `./phone.ts`) which the @/
 * alias loader does not handle.
 */
import { existsSync, statSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const stubUrl = new URL('./agent-search-stub.mjs', import.meta.url).href;

const STUBBED = new Set([
  'next/server',
  'next/headers',
  '@/lib/prisma',
]);

function tryTs(basePath) {
  for (const ext of ['.ts', '.tsx', '.mts', '']) {
    const full = basePath + ext;
    try {
      if (existsSync(full) && statSync(full).isFile()) {
        return pathToFileURL(full).href;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function resolve(specifier, context, nextResolve) {
  if (
    STUBBED.has(specifier) ||
    specifier.endsWith('/lib/prisma') ||
    specifier.endsWith('/lib/prisma.ts')
  ) {
    return { url: stubUrl, shortCircuit: true };
  }
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    context.parentURL &&
    context.parentURL.startsWith('file:')
  ) {
    const base = path.resolve(fileURLToPath(new URL(specifier, context.parentURL)));
    const normalized = base.split(path.sep).join('/');
    // tenant-guard.ts lazily imports './prisma.ts' inside unsafeUnscoped();
    // route it to the stub so the in-memory prisma backs the search query.
    if (normalized.endsWith('/src/lib/prisma.ts')) {
      return { url: stubUrl, shortCircuit: true };
    }
    const url = tryTs(base);
    if (url) return { url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
