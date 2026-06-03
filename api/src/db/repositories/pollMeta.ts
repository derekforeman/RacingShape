import type { Db } from '../connection.js';

export function getMeta(db: Db, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM poll_meta WHERE key = ?').get(key) as
    | { value: string | null }
    | undefined;
  if (!row || row.value === null) return undefined;
  return row.value;
}

export function setMeta(db: Db, key: string, value: string): void {
  db.prepare(
    `INSERT INTO poll_meta (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}
