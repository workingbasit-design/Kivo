/**
 * Part D (dashboard rebuild): resolve hook for the dashboard consistency
 * tests. Redirects `@/lib/prisma` to the in-memory stub so the dashboard
 * fetchers run against a fixed, timezone-sensitive dataset without a
 * database. Pure modules (money, revenue, utils, trade-icons, i18n)
 * resolve normally - the real fetchers are what's under test.
 *
 * The redirect is ARMED only when the entry module being loaded is the
 * consistency test file itself (node --test runs each test file in its own
 * process, so a module-level flag is safe). Every other test file resolves
 * `@/lib/prisma` normally.
 */
const stubUrl = new URL('./dashboard-consistency-stub.mjs', import.meta.url).href;

let armed = false;

export async function resolve(specifier, context, nextResolve) {
  if (!armed && /(^|\/)dashboard-consistency\.test\.mts$/.test(specifier)) {
    armed = true;
  }
  if (
    armed &&
    (specifier === '@/lib/prisma' ||
      /(^|\/)lib\/prisma(\.ts)?$/.test(specifier))
  ) {
    return { url: stubUrl, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
