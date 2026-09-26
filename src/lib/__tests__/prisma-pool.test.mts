import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pooledDatabaseUrl } from '../prisma.ts';

describe('pooledDatabaseUrl', () => {
  it('returns undefined when DATABASE_URL is missing', () => {
    assert.equal(pooledDatabaseUrl(undefined), undefined);
    assert.equal(pooledDatabaseUrl(''), undefined);
  });

  it('appends connection_limit with ? when the URL has no query string', () => {
    assert.equal(
      pooledDatabaseUrl('postgresql://u:p@host:5432/db'),
      'postgresql://u:p@host:5432/db?connection_limit=1',
    );
  });

  it('appends connection_limit with & when the URL already has a query string', () => {
    assert.equal(
      pooledDatabaseUrl('postgresql://u:p@host:5432/db?sslmode=require'),
      'postgresql://u:p@host:5432/db?sslmode=require&connection_limit=1',
    );
  });

  it('leaves the URL untouched when connection_limit is already set', () => {
    const url = 'postgresql://u:p@host:5432/db?connection_limit=1&sslmode=require';
    assert.equal(pooledDatabaseUrl(url), url);
  });
});
