import type { Db } from '../connection.js';

export interface HttpCacheRow {
  url: string;
  etag: string | null;
  lastModified: string | null;
  body: string | null;
  fetchedAt: string; // ISO UTC
}

interface DbRow {
  url: string;
  etag: string | null;
  last_modified: string | null;
  body: string | null;
  fetched_at: string;
}

export function get(db: Db, url: string): HttpCacheRow | undefined {
  const row = db.prepare('SELECT * FROM http_cache WHERE url = ?').get(url) as DbRow | undefined;
  if (!row) return undefined;
  return {
    url: row.url,
    etag: row.etag,
    lastModified: row.last_modified,
    body: row.body,
    fetchedAt: row.fetched_at,
  };
}

export function put(db: Db, row: HttpCacheRow): void {
  db.prepare(
    `INSERT INTO http_cache (url, etag, last_modified, body, fetched_at)
     VALUES (@url, @etag, @lastModified, @body, @fetchedAt)
     ON CONFLICT(url) DO UPDATE SET
       etag          = excluded.etag,
       last_modified = excluded.last_modified,
       body          = excluded.body,
       fetched_at    = excluded.fetched_at`,
  ).run(row);
}
