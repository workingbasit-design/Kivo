/**
 * Unit tests for the certification roadmap (src/lib/certifications.ts).
 * Guards the hard rule: every recommended program must be a real,
 * verifiable credential with an official URL — never invented.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { getCertificationRoadmap, TRADE_KEYS } from '../certifications.ts';

const KNOWN_OFFICIAL_HOSTS = [
  'red-seal.ca',
  'skilledtradesontario.ca',
  'skilledtradesbc.ca',
  'tradesecrets.alberta.ca',
  'saskapprenticeship.ca',
  'nsapprenticeship.ca',
  'ccq.org',
  'cmmtq.org',
  'rbq.gouv.qc.ca',
  'bbb.org',
  'hrai.ca',
  'chba.ca',
  'esasafe.com',
];

test('roadmap only links to known official domains', () => {
  for (const trade of TRADE_KEYS) {
    for (const province of ['ON', 'BC', 'AB', 'SK', 'MB', 'QC', 'NS', null]) {
      for (const cert of getCertificationRoadmap(trade, province)) {
        const host = new URL(cert.url).hostname.replace(/^www\./, '');
        assert.ok(
          KNOWN_OFFICIAL_HOSTS.includes(host),
          `${trade}/${province}: unexpected URL ${cert.url}`
        );
        assert.ok(cert.name.length > 0 && cert.issuer.length > 0, 'name/issuer required');
        assert.ok(cert.why.en.length > 0 && cert.why.fr.length > 0, 'EN+FR rationale required');
      }
    }
  }
});

test('plumbing in Ontario gets Red Seal + Skilled Trades Ontario', () => {
  const roadmap = getCertificationRoadmap('plumbing', 'ON');
  assert.ok(roadmap.some((c) => c.id === 'red-seal' && c.name.includes('Plumber')));
  assert.ok(roadmap.some((c) => c.url.includes('skilledtradesontario.ca')));
});

test('Quebec plumbing gets CMMTQ; Quebec renovation gets RBQ', () => {
  const plumbing = getCertificationRoadmap('plumbing', 'QC');
  assert.ok(plumbing.some((c) => c.id === 'cmmtq'));
  const reno = getCertificationRoadmap('renovation', 'QC');
  assert.ok(reno.some((c) => c.id === 'rbq'));
});

test('Ontario electrical gets the ESA contractor licence', () => {
  const roadmap = getCertificationRoadmap('electrical', 'ON');
  assert.ok(roadmap.some((c) => c.id === 'esa-contractor'));
});

test('HVAC gets HRAI; every roadmap ends with BBB', () => {
  const hvac = getCertificationRoadmap('hvac', 'AB');
  assert.ok(hvac.some((c) => c.id === 'hrai'));
  for (const trade of TRADE_KEYS) {
    const roadmap = getCertificationRoadmap(trade, 'ON');
    assert.equal(roadmap[roadmap.length - 1].id, 'bbb');
  }
});

test('unknown province falls back to the Red Seal jurisdictional directory', () => {
  const roadmap = getCertificationRoadmap('carpentry', 'YT');
  assert.ok(roadmap.some((c) => c.id === 'provincial-body'));
});

test('roadmap is deterministic and has no duplicates', () => {
  const a = getCertificationRoadmap('plumbing', 'ON').map((c) => c.id);
  const b = getCertificationRoadmap('plumbing', 'ON').map((c) => c.id);
  assert.deepEqual(a, b);
  assert.equal(new Set(a).size, a.length, 'duplicate certification ids');
});
