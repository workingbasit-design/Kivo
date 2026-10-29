/**
 * Regression tests for the 2026-10-29 deep-test crew/project failures:
 * - CrewForm Save (updateCrew) and Delete (deleteCrew) crashed the crew
 *   detail page with an error boundary, because both called
 *   prisma.crew.update()/delete() with `where: { id }` and no businessId;
 *   the tenant guard fails closed on unscoped writes (TenantScopeError),
 *   and CrewForm's transition has no catch, so the throw hit the boundary.
 * - updateProject, deleteProject, attachJobToProject and
 *   detachJobFromProject shared the same unscoped-write shape on the
 *   Project/Job models.
 *
 * These tests stub prisma/auth and run the REAL guard assertion inside
 * the stubbed writes - a regression throws TenantScopeError here, as in
 * prod.
 *
 * Run: node --test --import ./src/lib/__tests__/register-loader.mjs src/lib/__tests__/crew-project-tenant-scope.test.mts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { register } from 'node:module';

register('./register-loader.mjs', import.meta.url);
register('./crew-project-tenant-scope-stub-loader.mjs', import.meta.url);

const { updateCrew, deleteCrew } = await import('@/app/actions/crews.ts');
const { updateProject, deleteProject, attachJobToProject, detachJobFromProject } =
  await import('@/app/actions/projects.ts');
const stub = await import('./crew-project-tenant-scope-stub.mjs');

test('updateCrew scopes the update by businessId (no TenantScopeError)', async () => {
  stub.resetCrewProjectStub();
  const res = await updateCrew('crew_1', 'Renamed Crew', '#38bdf8');
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(stub.crewUpdateCalls.length, 1);
  assert.equal(stub.crewUpdateCalls[0].where.businessId, 'biz_1');
  assert.equal(stub.crewUpdateCalls[0].where.id, 'crew_1');
  assert.equal(stub.crewUpdateCalls[0].data.name, 'Renamed Crew');
});

test('updateCrew unknown id returns not-found without writing', async () => {
  stub.resetCrewProjectStub();
  const res = await updateCrew('crew_missing', 'Nope', '#38bdf8');
  assert.equal(res.ok, undefined);
  assert.equal(stub.crewUpdateCalls.length, 0);
});

test('deleteCrew scopes the delete by businessId (no TenantScopeError)', async () => {
  stub.resetCrewProjectStub();
  const res = await deleteCrew('crew_1');
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(stub.crewDeleteCalls.length, 1);
  assert.equal(stub.crewDeleteCalls[0].where.businessId, 'biz_1');
  assert.equal(stub.crewDeleteCalls[0].where.id, 'crew_1');
});

test('updateProject scopes the update by businessId (no TenantScopeError)', async () => {
  stub.resetCrewProjectStub();
  const res = await updateProject('proj_1', { title: 'Renamed Project' });
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(stub.projectUpdateCalls.length, 1);
  assert.equal(stub.projectUpdateCalls[0].where.businessId, 'biz_1');
  assert.equal(stub.projectUpdateCalls[0].where.id, 'proj_1');
  assert.equal(stub.projectUpdateCalls[0].data.title, 'Renamed Project');
});

test('deleteProject scopes the delete by businessId and clears job links scoped', async () => {
  stub.resetCrewProjectStub();
  const res = await deleteProject('proj_1');
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(stub.projectDeleteCalls.length, 1);
  assert.equal(stub.projectDeleteCalls[0].where.businessId, 'biz_1');
  assert.equal(stub.projectDeleteCalls[0].where.id, 'proj_1');
  assert.equal(stub.jobUpdateCalls.length, 1);
  assert.equal(stub.jobUpdateCalls[0].where.businessId, 'biz_1');
  assert.equal(stub.jobUpdateCalls[0].data.projectId, null);
});

test('attachJobToProject scopes the job update by businessId', async () => {
  stub.resetCrewProjectStub();
  const res = await attachJobToProject('job_1', 'proj_1');
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(stub.jobUpdateCalls.length, 1);
  assert.equal(stub.jobUpdateCalls[0].where.businessId, 'biz_1');
  assert.equal(stub.jobUpdateCalls[0].where.id, 'job_1');
  assert.equal(stub.jobUpdateCalls[0].data.projectId, 'proj_1');
});

test('detachJobFromProject scopes the job update by businessId', async () => {
  stub.resetCrewProjectStub();
  const res = await detachJobFromProject('job_1');
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.equal(stub.jobUpdateCalls.length, 1);
  assert.equal(stub.jobUpdateCalls[0].where.businessId, 'biz_1');
  assert.equal(stub.jobUpdateCalls[0].where.id, 'job_1');
  assert.equal(stub.jobUpdateCalls[0].data.projectId, null);
});
