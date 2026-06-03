import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import {
  upsertDailyStats,
  getRange,
  type DailyStatsRow,
} from '../../../src/db/repositories/dailyStats.js';

function freshDb() {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

const row = (over: Partial<DailyStatsRow>): DailyStatsRow => ({
  raceDate: '2026-06-02',
  commits: 0,
  prsOpened: 0,
  prsMerged: 0,
  issuesClosed: 0,
  ...over,
});

describe('dailyStats repository', () => {
  it('inserts and reads back a row in range', () => {
    const db = freshDb();
    upsertDailyStats(db, row({ raceDate: '2026-06-02', commits: 5, prsOpened: 2 }));
    const range = getRange(db, '2026-06-01', '2026-06-03');
    expect(range).toEqual([
      { raceDate: '2026-06-02', commits: 5, prsOpened: 2, prsMerged: 0, issuesClosed: 0 },
    ]);
  });

  it('upsert overwrites an existing day', () => {
    const db = freshDb();
    upsertDailyStats(db, row({ raceDate: '2026-06-02', commits: 5 }));
    upsertDailyStats(db, row({ raceDate: '2026-06-02', commits: 9, prsMerged: 1 }));
    const range = getRange(db, '2026-06-02', '2026-06-02');
    expect(range[0]).toEqual({
      raceDate: '2026-06-02',
      commits: 9,
      prsOpened: 0,
      prsMerged: 1,
      issuesClosed: 0,
    });
  });

  it('getRange returns rows ordered by date ascending and respects bounds', () => {
    const db = freshDb();
    upsertDailyStats(db, row({ raceDate: '2026-06-03', commits: 3 }));
    upsertDailyStats(db, row({ raceDate: '2026-06-01', commits: 1 }));
    upsertDailyStats(db, row({ raceDate: '2026-05-31', commits: 99 })); // out of range
    const dates = getRange(db, '2026-06-01', '2026-06-03').map((r) => r.raceDate);
    expect(dates).toEqual(['2026-06-01', '2026-06-03']);
  });

  it('returns an empty array for an empty range', () => {
    const db = freshDb();
    expect(getRange(db, '2026-06-01', '2026-06-03')).toEqual([]);
  });
});
