/**
 * Unit tests for directory claim verification pure logic
 * (src/lib/directory.ts — Track 4A).
 * Run: node --test src/lib/__tests__/directory-claim.test.mts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isListingPublic,
  parseServiceAreas,
  serviceAreasToJson,
  claimTransition,
} from '@/lib/directory-claim.ts';
import { LEAD_STATUSES } from '@/lib/validations.ts';

test('isListingPublic requires BOTH opt-in and verification', () => {
  assert.equal(isListingPublic(true, new Date()), true);
  assert.equal(isListingPublic(true, null), false);
  assert.equal(isListingPublic(true, undefined), false);
  assert.equal(isListingPublic(false, new Date()), false);
  assert.equal(isListingPublic(false, null), false);
});

test('parseServiceAreas never throws and cleans input', () => {
  assert.deepEqual(parseServiceAreas(null), []);
  assert.deepEqual(parseServiceAreas(''), []);
  assert.deepEqual(parseServiceAreas('not json'), []);
  assert.deepEqual(parseServiceAreas('{"a":1}'), []);
  assert.deepEqual(
    parseServiceAreas(JSON.stringify(['Toronto', ' Scarborough ', '', 42, null])),
    ['Toronto', 'Scarborough']
  );
  const many = Array.from({ length: 20 }, (_, i) => `City ${i}`);
  assert.equal(parseServiceAreas(JSON.stringify(many)).length, 12);
});

test('serviceAreasToJson normalizes free text', () => {
  assert.equal(serviceAreasToJson(''), null);
  assert.equal(serviceAreasToJson(null), null);
  assert.equal(
    serviceAreasToJson('Toronto, Scarborough\nEast York , ,'),
    JSON.stringify(['Toronto', 'Scarborough', 'East York'])
  );
  // Round-trip: toJson -> parse returns the same list.
  const json = serviceAreasToJson('Toronto, Mississauga');
  assert.deepEqual(parseServiceAreas(json), ['Toronto', 'Mississauga']);
});

test('claimTransition: request never auto-publishes', () => {
  assert.deepEqual(
    claimTransition({ status: null, verifiedAt: null }, 'request'),
    { status: 'PENDING', public: false }
  );
  // Re-request after rejection also goes back to pending, still unpublished.
  assert.deepEqual(
    claimTransition({ status: 'REJECTED', verifiedAt: null }, 'request'),
    { status: 'PENDING', public: false }
  );
});

test('claimTransition: approve publishes, reject/opt_out unpublish', () => {
  assert.deepEqual(
    claimTransition({ status: 'PENDING', verifiedAt: null }, 'approve'),
    { status: 'APPROVED', public: true }
  );
  assert.deepEqual(
    claimTransition({ status: 'PENDING', verifiedAt: null }, 'reject'),
    { status: 'REJECTED', public: false }
  );
  assert.deepEqual(
    claimTransition({ status: 'APPROVED', verifiedAt: new Date() }, 'opt_out'),
    { status: 'APPROVED', public: false }
  );
});

test('LEAD_STATUSES includes DECLINED for directory lead triage', () => {
  assert.ok((LEAD_STATUSES as readonly string[]).includes('DECLINED'));
  assert.ok((LEAD_STATUSES as readonly string[]).includes('NEW'));
  assert.ok((LEAD_STATUSES as readonly string[]).includes('CONVERTED'));
});
