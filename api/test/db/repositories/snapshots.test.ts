import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import {
  insertSnapshot,
  framesForDate,
  latestScores,
} from '../../../src/db/repositories/snapshots.js';

function freshDb() {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

describe('snapshots repository', () => {
  it('groups rows into frames ordered by capturedAt', () => {
    const db = freshDb();
    insertSnapshot(db, '2026-06-02', 'devon-r', 5, '2026-06-02T12:00:00.000Z');
    insertSnapshot(db, '2026-06-02', 'amy', 3, '2026-06-02T12:00:00.000Z');
    insertSnapshot(db, '2026-06-02', 'devon-r', 9, '2026-06-02T12:05:00.000Z');
    insertSnapshot(db, '2026-06-02', 'amy', 7, '2026-06-02T12:05:00.000Z');

    const frames = framesForDate(db, '2026-06-02');
    expect(frames).toEqual([
      {
        capturedAt: '2026-06-02T12:00:00.000Z',
        scores: [
          { login: 'amy', score: 3 },
          { login: 'devon-r', score: 5 },
        ],
      },
      {
        capturedAt: '2026-06-02T12:05:00.000Z',
        scores: [
          { login: 'amy', score: 7 },
          { login: 'devon-r', score: 9 },
        ],
      },
    ]);
  });

  it('insertSnapshot is idempotent on (race_date, login, captured_at)', () => {
    const db = freshDb();
    insertSnapshot(db, '2026-06-02', 'devon-r', 5, '2026-06-02T12:00:00.000Z');
    insertSnapshot(db, '2026-06-02', 'devon-r', 5, '2026-06-02T12:00:00.000Z');
    const frames = framesForDate(db, '2026-06-02');
    expect(frames).toHaveLength(1);
    expect(frames[0]?.scores).toHaveLength(1);
  });

  it('latestScores returns each racer score from the most recent frame', () => {
    const db = freshDb();
    insertSnapshot(db, '2026-06-02', 'devon-r', 5, '2026-06-02T12:00:00.000Z');
    insertSnapshot(db, '2026-06-02', 'amy', 3, '2026-06-02T12:00:00.000Z');
    insertSnapshot(db, '2026-06-02', 'devon-r', 9, '2026-06-02T12:05:00.000Z');
    const latest = latestScores(db, '2026-06-02');
    expect(latest.get('devon-r')).toBe(9);
    // amy not in the latest frame -> absent
    expect(latest.has('amy')).toBe(false);
  });

  it('returns empties for an unknown date', () => {
    const db = freshDb();
    expect(framesForDate(db, '2099-01-01')).toEqual([]);
    expect(latestScores(db, '2099-01-01').size).toBe(0);
  });
});
