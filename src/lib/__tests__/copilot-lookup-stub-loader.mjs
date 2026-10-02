/**
 * Resolve hook for the copilot lookup GET tests.
 *
 * Redirects framework/data modules to the in-memory stub, and resolves
 * extensionless relative imports (`./parse` -> `./parse.ts`) which the @/
 * alias loader does not handle.
 */
import { existsSync, statSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const stubUrl = new URL('./copilot-lookup-stub.mjs', import.meta.url).href;

const STUBBED = new Set([
  'next/server',
  '@/lib/prisma',
  '@/lib/auth',
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
