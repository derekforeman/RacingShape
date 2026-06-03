import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import { getMeta, setMeta } from '../../../src/db/repositories/pollMeta.js';

function freshDb() {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

describe('pollMeta repository', () => {
  it('returns undefined for an unknown key', () => {
    const db = freshDb();
    expect(getMeta(db, 'lastPolledAt')).toBeUndefined();
  });

  it('sets and gets a string value', () => {
    const db = freshDb();
    setMeta(db, 'lastPolledAt', '2026-06-02T12:00:00.000Z');
    expect(getMeta(db, 'lastPolledAt')).toBe('2026-06-02T12:00:00.000Z');
  });

  it('setMeta overwrites an existing key', () => {
    const db = freshDb();
    setMeta(db, 'k', 'one');
    setMeta(db, 'k', 'two');
    expect(getMeta(db, 'k')).toBe('two');
  });
});
