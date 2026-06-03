import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import {
  insertEventsIgnore,
  breakdownByRacer,
  countsForRange,
  type EventRow,
} from '../../../src/db/repositories/events.js';

function freshDb() {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

const ev = (over: Partial<EventRow>): EventRow => ({
  id: 'commit:abc',
  racerLogin: 'devon-r',
  type: 'commit',
  points: 1,
  occurredAt: '2026-06-02T12:00:00.000Z',
  raceDate: '2026-06-02',
  ...over,
});

describe('events repository', () => {
  it('inserts events', () => {
    const db = freshDb();
    insertEventsIgnore(db, [ev({ id: 'commit:1' }), ev({ id: 'commit:2' })]);
    const map = breakdownByRacer(db, '2026-06-02');
    expect(map.get('devon-r')?.commit).toBe(2);
  });

  it('dedupes on id via INSERT OR IGNORE (re-poll is idempotent)', () => {
    const db = freshDb();
    insertEventsIgnore(db, [ev({ id: 'commit:1' })]);
    insertEventsIgnore(db, [ev({ id: 'commit:1' }), ev({ id: 'commit:2' })]);
    const map = breakdownByRacer(db, '2026-06-02');
    expect(map.get('devon-r')?.commit).toBe(2); // not 3
  });

  it('breakdownByRacer counts each type per racer for the given race_date', () => {
    const db = freshDb();
    insertEventsIgnore(db, [
      ev({ id: 'commit:1', type: 'commit', points: 1 }),
      ev({ id: 'commit:2', type: 'commit', points: 1 }),
      ev({ id: 'pr_opened:10', type: 'pr_opened', points: 5 }),
      ev({ id: 'pr_merged:10', type: 'pr_merged', points: 8 }),
      ev({ id: 'issue_closed:7', type: 'issue_closed', points: 3 }),
      ev({ id: 'commit:3', type: 'commit', points: 1, racerLogin: 'amy' }),
      // different day — excluded
      ev({ id: 'commit:9', type: 'commit', points: 1, raceDate: '2026-06-01' }),
    ]);
    const map = breakdownByRacer(db, '2026-06-02');
    expect(map.get('devon-r')).toEqual({
      commit: 2,
      pr_opened: 1,
      pr_merged: 1,
      issue_closed: 1,
    });
    expect(map.get('amy')).toEqual({
      commit: 1,
      pr_opened: 0,
      pr_merged: 0,
      issue_closed: 0,
    });
    expect(map.has('commit:9')).toBe(false);
  });

  it('returns an empty map for a day with no events', () => {
    const db = freshDb();
    expect(breakdownByRacer(db, '2026-06-02').size).toBe(0);
  });

  it('countsForRange aggregates per type across the inclusive date range', () => {
    const db = freshDb();
    insertEventsIgnore(db, [
      ev({ id: 'commit:1', type: 'commit', raceDate: '2026-06-01' }),
      ev({ id: 'pr_opened:1', type: 'pr_opened', raceDate: '2026-06-02' }),
      ev({ id: 'pr_merged:1', type: 'pr_merged', raceDate: '2026-06-02' }),
      ev({ id: 'issue_closed:1', type: 'issue_closed', raceDate: '2026-06-03' }),
      ev({ id: 'commit:99', type: 'commit', raceDate: '2026-05-31' }), // out of range
    ]);
    const counts = countsForRange(db, '2026-06-01', '2026-06-03');
    expect(counts).toEqual({
      commit: 1,
      pr_opened: 1,
      pr_merged: 1,
      issue_closed: 1,
    });
  });
});
