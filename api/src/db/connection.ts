import Database from 'better-sqlite3';

export type Db = Database.Database;

/**
 * Open a better-sqlite3 database with the pragmas RacingShape relies on:
 * - WAL for concurrent read while the poller writes.
 * - foreign_keys ON for referential safety.
 * Pass ':memory:' for tests.
 */
export function openDb(path: string): Db {
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  return db;
}
