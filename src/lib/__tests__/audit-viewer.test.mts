/**
 * P1.0 F2: the audit log viewer.
 *
 * The viewer is the read side of the F1 audit trail: it must show ONLY
 * the signed-in business's rows, only to OWNER/ADMIN, with validated
 * filters and a bounded read (the log grows by one row per login and
 * money action, so it is never loaded whole). Actor names come from a
 * single lookup over the actor ids on screen — never an unscoped user
 * list.
 *
 * Source-wiring pins in the repo's readFileSync style.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..', '..', '..');
const PAGE = readFileSync(
  join(REPO, 'src/app/(app)/settings/audit/page.tsx'),
  'utf8'
);
const NAV = readFileSync(join(REPO, 'src/components/nav-sections.ts'), 'utf8');
const SETTINGS = readFileSync(join(REPO, 'src/app/(app)/settings/page.tsx'), 'utf8');

test('viewer queries AuditEvent scoped by businessId', () => {
  assert.match(PAGE, /prisma\.auditEvent\.findMany/);
  // One shared `where` carries businessId into both the read and the count.
  assert.match(PAGE, /const where = \{\s*businessId,/);
  assert.match(PAGE, /prisma\.auditEvent\.findMany\(\{\s*where,/);
  assert.match(PAGE, /prisma\.auditEvent\.count\(\{\s*where\s*\}\)/);
});

test('viewer is OWNER/ADMIN only and redirects anyone else to /settings', () => {
  assert.match(PAGE, /role !== 'ADMIN' && role !== 'OWNER'/);
  assert.match(PAGE, /redirect\('\/settings'\)/);
});

test('filters are validated, never passed raw into the query', () => {
  // Action must be in the AUDIT_ACTIONS vocabulary; anything else is ignored.
  assert.match(PAGE, /AUDIT_ACTIONS.*includes\(actionFilter\)/);
  // Entity must be in the page's fixed ENTITY_TYPES list.
  assert.match(PAGE, /ENTITY_TYPES.*includes\(entityFilter\)/);
  assert.doesNotMatch(PAGE, /action:\s*params\?\.action/);
  assert.doesNotMatch(PAGE, /entityType:\s*params\?\.entity/);
});

test('viewer reads are bounded (Tier A pattern) with an exact total', () => {
  assert.match(PAGE, /parseListLimit\(/);
  assert.match(PAGE, /take: takeWithProbe\(limit\)/);
  assert.match(PAGE, /sliceListPage\(fetched, limit\)/);
  // The exact total comes from the database, not the fetched page.
  assert.match(PAGE, /prisma\.auditEvent\.count/);
  // Show-more preserves the filters.
  assert.match(PAGE, /params=\{\{ action, entity \}\}/);
});

test('actor names come from one lookup over the on-screen actor ids', () => {
  assert.match(PAGE, /prisma\.user\.findMany\(\{\s*where:\s*\{\s*id:\s*\{\s*in: actorIds/);
  assert.doesNotMatch(PAGE, /prisma\.user\.findMany\(\{\s*\}\)/);
  // The 'system' actor never hits the user table.
  assert.match(PAGE, /filter\(\(id\) => id !== 'system'\)/);
});

test('audit log is reachable from the nav and the settings page', () => {
  assert.match(NAV, /nameKey: 'nav\.auditLog', href: '\/settings\/audit'/);
  assert.match(SETTINGS, /href="\/settings\/audit"/);
});
