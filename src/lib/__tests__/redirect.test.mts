/** B7.7 open-redirect guard tests. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { safeNext } from '../redirect.ts';

describe('safeNext', () => {
  it('allows relative in-app paths', () => {
    assert.equal(safeNext('/dashboard'), '/dashboard');
    assert.equal(safeNext('/customer/requests?page=2'), '/customer/requests?page=2');
  });
  it('rejects absolute external URLs', () => {
    assert.equal(safeNext('https://evil.com'), null);
    assert.equal(safeNext('http://evil.com/x'), null);
  });
  it('rejects protocol-relative URLs', () => {
    assert.equal(safeNext('//evil.com'), null);
  });
  it('rejects backslash tricks', () => {
    assert.equal(safeNext('/\\evil.com'), null);
    assert.equal(safeNext('/\\'), null);
  });
  it('rejects empty/missing input', () => {
    assert.equal(safeNext(''), null);
    assert.equal(safeNext(undefined), null);
    assert.equal(safeNext(null), null);
    assert.equal(safeNext('   '), null);
  });
  it('rejects non-path strings', () => {
    assert.equal(safeNext('dashboard'), null);
    assert.equal(safeNext('javascript:alert(1)'), null);
  });
});
