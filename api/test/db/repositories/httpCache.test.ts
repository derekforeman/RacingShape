import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import { get, put, type HttpCacheRow } from '../../../src/db/repositories/httpCache.js';

function freshDb() {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

describe('httpCache repository', () => {
  it('returns undefined for an uncached url', () => {
    const db = freshDb();
    expect(get(db, 'https://api.github.com/x')).toBeUndefined();
  });

  it('stores and retrieves a cache entry by url', () => {
    const db = freshDb();
    const entry: HttpCacheRow = {
      url: 'https://api.github.com/x',
      etag: 'W/"abc"',
      lastModified: 'Wed, 02 Jun 2026 12:00:00 GMT',
      body: '[{"sha":"1"}]',
      fetchedAt: '2026-06-02T12:00:00.000Z',
    };
    put(db, entry);
    expect(get(db, 'https://api.github.com/x')).toEqual(entry);
  });

  it('put overwrites the existing entry for a url', () => {
    const db = freshDb();
    put(db, {
      url: 'u',
      etag: 'e1',
      lastModified: null,
      body: 'b1',
      fetchedAt: '2026-06-02T12:00:00.000Z',
    });
    put(db, {
      url: 'u',
      etag: 'e2',
      lastModified: null,
      body: 'b2',
      fetchedAt: '2026-06-02T12:05:00.000Z',
    });
    expect(get(db, 'u')).toEqual({
      url: 'u',
      etag: 'e2',
      lastModified: null,
      body: 'b2',
      fetchedAt: '2026-06-02T12:05:00.000Z',
    });
  });

  it('allows null etag/lastModified/body', () => {
    const db = freshDb();
    put(db, { url: 'u2', etag: null, lastModified: null, body: null, fetchedAt: 't' });
    expect(get(db, 'u2')).toEqual({
      url: 'u2',
      etag: null,
      lastModified: null,
      body: null,
      fetchedAt: 't',
    });
  });
});
