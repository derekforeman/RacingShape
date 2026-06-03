import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { conditionalGet, type RequestFn } from '../../src/github/client.js';

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

describe('conditionalGet', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = freshDb();
  });

  it('stores etag + body on a 200 and returns the parsed data', async () => {
    const fakeRequest = (async () => ({
      status: 200,
      headers: { etag: 'W/"abc"' },
      data: [{ x: 1 }],
    })) as unknown as RequestFn;
    const out = await conditionalGet(db, fakeRequest, 'GET /repos/o/r/commits', { foo: 'bar' });
    expect(out).toEqual([{ x: 1 }]);
    const row = db
      .prepare('SELECT etag, body FROM http_cache WHERE url = ?')
      .get('GET /repos/o/r/commits') as { etag: string; body: string };
    expect(row.etag).toBe('W/"abc"');
    expect(JSON.parse(row.body)).toEqual([{ x: 1 }]);
  });

  it('sends If-None-Match with the stored etag on a subsequent call', async () => {
    db.prepare(
      'INSERT INTO http_cache(url, etag, last_modified, body, fetched_at) VALUES (?,?,?,?,?)',
    ).run('GET /x', 'W/"e1"', null, JSON.stringify([{ cached: true }]), '2026-06-02T00:00:00.000Z');

    let seenHeaders: Record<string, string> | undefined;
    const fakeRequest = (async (_route: string, opts: { headers?: Record<string, string> }) => {
      seenHeaders = opts.headers;
      const err = new Error('Not Modified') as Error & { status?: number };
      err.status = 304;
      throw err;
    }) as unknown as RequestFn;
    const out = await conditionalGet(db, fakeRequest, 'GET /x', {});
    expect(seenHeaders?.['if-none-match']).toBe('W/"e1"');
    expect(out).toEqual([{ cached: true }]);
  });

  it('returns fresh data and updates the cache on a 200 that replaces a cached entry', async () => {
    db.prepare(
      'INSERT INTO http_cache(url, etag, last_modified, body, fetched_at) VALUES (?,?,?,?,?)',
    ).run('GET /y', 'W/"old"', null, JSON.stringify([{ v: 'old' }]), '2026-06-02T00:00:00.000Z');

    const fakeRequest = (async () => ({
      status: 200,
      headers: { etag: 'W/"new"' },
      data: [{ v: 'new' }],
    })) as unknown as RequestFn;
    const out = await conditionalGet(db, fakeRequest, 'GET /y', {});
    expect(out).toEqual([{ v: 'new' }]);
    const row = db.prepare('SELECT etag FROM http_cache WHERE url = ?').get('GET /y') as {
      etag: string;
    };
    expect(row.etag).toBe('W/"new"');
  });
});
