/**
 * Resolve hook for the copilot route test (2026-11-08).
 * Redirects framework/data modules to the in-memory stub, and resolves
 * extensionless relative imports (`./parse` -> `./parse.ts`) which the @/
 * alias loader does not handle (same structure as
 * copilot-lookup-stub-loader.mjs).
 */
import { existsSync, statSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const stubUrl = new URL('./copilot-route-stub.mjs', import.meta.url).href;

const STUBBED = new Set([
  'next/server',
  '@/lib/prisma',
  '@/lib/auth',
  '@/lib/membership',
  '@/lib/rate-limit',
  '@/lib/csrf',
  '@/lib/i18n/server',
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
    specifier.endsWith('/lib/prisma.ts') ||
    specifier.endsWith('/lib/auth') ||
    specifier.endsWith('/lib/auth.ts') ||
    specifier.endsWith('/lib/membership') ||
    specifier.endsWith('/lib/membership.ts') ||
    specifier.endsWith('/lib/rate-limit') ||
    specifier.endsWith('/lib/rate-limit.ts') ||
    specifier.endsWith('/lib/csrf') ||
    specifier.endsWith('/lib/csrf.ts') ||
    specifier.endsWith('/i18n/server') ||
    specifier.endsWith('/i18n/server.ts')
  ) {
    return { url: stubUrl, shortCircuit: true };
  }
  if (
    (specifier.startsWith('./') || specifier.startsWith('../')) &&
    context.parentURL &&
    context.parentURL.startsWith('file:')
  ) {
    const base = path.resolve(fileURLToPath(new URL(specifier, context.parentURL)));
    const url = tryTs(base);
    if (url) return { url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
