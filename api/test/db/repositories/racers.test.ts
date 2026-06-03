import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import { upsertRacer, getRacer, listRacers } from '../../../src/db/repositories/racers.js';

function freshDb() {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

describe('racers repository', () => {
  it('inserts and reads a racer', () => {
    const db = freshDb();
    upsertRacer(db, {
      login: 'devon-r',
      displayName: 'Devon R',
      avatarUrl: 'https://a/devon.png',
      firstSeen: '2026-06-02T10:00:00.000Z',
    });
    const r = getRacer(db, 'devon-r');
    expect(r).toEqual({
      login: 'devon-r',
      displayName: 'Devon R',
      avatarUrl: 'https://a/devon.png',
      firstSeen: '2026-06-02T10:00:00.000Z',
    });
  });

  it('returns undefined for an unknown login', () => {
    const db = freshDb();
    expect(getRacer(db, 'nobody')).toBeUndefined();
  });

  it('upsert updates mutable fields but preserves firstSeen', () => {
    const db = freshDb();
    upsertRacer(db, {
      login: 'devon-r',
      displayName: 'Devon R',
      avatarUrl: 'https://a/old.png',
      firstSeen: '2026-06-02T10:00:00.000Z',
    });
    upsertRacer(db, {
      login: 'devon-r',
      displayName: 'Devon Rodriguez',
      avatarUrl: 'https://a/new.png',
      firstSeen: '2026-06-03T09:00:00.000Z', // later first_seen should be ignored
    });
    const r = getRacer(db, 'devon-r');
    expect(r?.displayName).toBe('Devon Rodriguez');
    expect(r?.avatarUrl).toBe('https://a/new.png');
    expect(r?.firstSeen).toBe('2026-06-02T10:00:00.000Z');
  });

  it('lists racers ordered by login ascending', () => {
    const db = freshDb();
    upsertRacer(db, { login: 'zoe', displayName: 'Zoe', avatarUrl: 'z', firstSeen: 't' });
    upsertRacer(db, { login: 'amy', displayName: 'Amy', avatarUrl: 'a', firstSeen: 't' });
    const logins = listRacers(db).map((r) => r.login);
    expect(logins).toEqual(['amy', 'zoe']);
  });
});
