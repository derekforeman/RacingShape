import { describe, it, expect } from 'vitest';
import { openDb } from '../../../src/db/connection.js';
import { migrate } from '../../../src/db/migrate.js';
import { insertReaction, insertCheer, summaryForDate, listForDate } from '../../../src/db/repositories/reactions.js';

function freshDb() { const db = openDb(':memory:'); migrate(db); return db; }

describe('cheers in the reactions table', () => {
  it('cheers do not inflate boost summaries', () => {
    const db = freshDb();
    insertReaction(db, { id: 'b1', raceDate: '2026-06-10', targetLogin: 'devon-r', kind: '🔥', reactor: 'amy', createdAt: '2026-06-10T12:00:00.000Z' });
    insertCheer(db, { id: 'c1', raceDate: '2026-06-10', targetLogin: 'devon-r', label: 'maya', createdAt: '2026-06-10T12:01:00.000Z' });
    insertCheer(db, { id: 'c2', raceDate: '2026-06-10', targetLogin: 'devon-r', label: 'a fan', createdAt: '2026-06-10T12:02:00.000Z' });
    const summary = summaryForDate(db, '2026-06-10', 'devon-r');
    expect(summary.total).toBe(1); // only the boost
  });

  it('listForDate returns source so replay can distinguish cheers', () => {
    const db = freshDb();
    insertReaction(db, { id: 'b1', raceDate: '2026-06-10', targetLogin: 'devon-r', kind: '🔥', reactor: 'amy', createdAt: '2026-06-10T12:00:00.000Z' });
    insertCheer(db, { id: 'c1', raceDate: '2026-06-10', targetLogin: 'devon-r', label: 'maya', createdAt: '2026-06-10T12:01:00.000Z' });
    const list = listForDate(db, '2026-06-10');
    expect(list.map((r) => r.source)).toEqual(['boost', 'cheer']);
    expect(list[1]).toMatchObject({ targetLogin: 'devon-r', kind: '🙌', reactor: 'maya', source: 'cheer' });
  });

  it('migrate adds source to a pre-existing reactions table (defaulting to boost)', () => {
    const db = openDb(':memory:');
    db.exec(`CREATE TABLE reactions (id TEXT PRIMARY KEY, race_date TEXT, target_racer_login TEXT, kind TEXT, reactor TEXT, created_at TEXT);
             INSERT INTO reactions VALUES ('old','2026-06-10','devon-r','🔥','amy','2026-06-10T10:00:00.000Z');`);
    migrate(db);
    const list = listForDate(db, '2026-06-10');
    expect(list[0].source).toBe('boost');
  });
});
