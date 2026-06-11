import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import {
  insertReaction,
  summaryForDate,
  listForDate,
  type ReactionRow,
} from '../../../src/db/repositories/reactions.js';

function freshDb() {
  const db = openDb(':memory:');
  migrate(db);
  return db;
}

const react = (over: Partial<ReactionRow>): ReactionRow => ({
  id: 'r1',
  raceDate: '2026-06-02',
  targetLogin: 'devon-r',
  kind: '🔥',
  reactor: 'amy',
  createdAt: '2026-06-02T12:00:00.000Z',
  ...over,
});

describe('reactions repository', () => {
  it('summaryForDate totals reactions for a target and breaks down by kind', () => {
    const db = freshDb();
    insertReaction(db, react({ id: 'r1', kind: '🔥' }));
    insertReaction(db, react({ id: 'r2', kind: '🔥' }));
    insertReaction(db, react({ id: 'r3', kind: '⚡' }));
    insertReaction(db, react({ id: 'r4', kind: '🏎️' }));
    // a reaction for a different target should not count
    insertReaction(db, react({ id: 'r5', targetLogin: 'amy', kind: '🔥' }));

    const summary = summaryForDate(db, '2026-06-02', 'devon-r');
    expect(summary).toEqual({
      total: 4,
      byKind: { '🔥': 2, '⚡': 1, '🏎️': 1 },
    });
  });

  it('returns a zeroed summary when there are no reactions', () => {
    const db = freshDb();
    expect(summaryForDate(db, '2026-06-02', 'devon-r')).toEqual({
      total: 0,
      byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 },
    });
  });

  it('insertReaction is idempotent on id', () => {
    const db = freshDb();
    insertReaction(db, react({ id: 'r1' }));
    insertReaction(db, react({ id: 'r1' }));
    expect(summaryForDate(db, '2026-06-02', 'devon-r').total).toBe(1);
  });

  it('listForDate returns archived reactions ordered by createdAt asc', () => {
    const db = freshDb();
    insertReaction(db, react({ id: 'r2', createdAt: '2026-06-02T13:00:00.000Z' }));
    insertReaction(db, react({ id: 'r1', createdAt: '2026-06-02T12:00:00.000Z' }));
    const list = listForDate(db, '2026-06-02');
    expect(list).toEqual([
      {
        targetLogin: 'devon-r',
        kind: '🔥',
        reactor: 'amy',
        createdAt: '2026-06-02T12:00:00.000Z',
        source: 'boost',
      },
      {
        targetLogin: 'devon-r',
        kind: '🔥',
        reactor: 'amy',
        createdAt: '2026-06-02T13:00:00.000Z',
        source: 'boost',
      },
    ]);
  });
});
