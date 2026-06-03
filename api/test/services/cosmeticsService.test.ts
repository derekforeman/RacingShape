import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { cosmeticsFor } from '../../src/services/cosmeticsService.js';

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

function addEvent(db: Database.Database, e: { id: string; login: string; type: string; points: number; at: string; date: string }) {
  db.prepare(
    'INSERT OR IGNORE INTO events(id, racer_login, type, points, occurred_at, race_date) VALUES (?,?,?,?,?,?)',
  ).run(e.id, e.login, e.type, e.points, e.at, e.date);
}

describe('cosmeticsFor', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = freshDb();
  });

  it('awards flame_trail for a 5-day streak ending on date', () => {
    const days = ['2026-05-29', '2026-05-30', '2026-05-31', '2026-06-01', '2026-06-02'];
    days.forEach((d, i) =>
      addEvent(db, { id: `commit:s${i}`, login: 'devon-r', type: 'commit', points: 1, at: `${d}T15:00:00.000Z`, date: d }),
    );
    const out = cosmeticsFor(db, '2026-06-02');
    expect(out.get('devon-r')).toContain('flame_trail');
  });

  it('does not award flame_trail for only a 4-day streak', () => {
    const days = ['2026-05-30', '2026-05-31', '2026-06-01', '2026-06-02'];
    days.forEach((d, i) =>
      addEvent(db, { id: `commit:s${i}`, login: 'mira-k', type: 'commit', points: 1, at: `${d}T15:00:00.000Z`, date: d }),
    );
    const out = cosmeticsFor(db, '2026-06-02');
    expect(out.get('mira-k') ?? []).not.toContain('flame_trail');
  });

  it('awards gold_rims to the author of the earliest pr_merged that day', () => {
    addEvent(db, { id: 'pr_merged:1', login: 'late', type: 'pr_merged', points: 8, at: '2026-06-02T18:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'pr_merged:2', login: 'early', type: 'pr_merged', points: 8, at: '2026-06-02T09:00:00.000Z', date: '2026-06-02' });
    const out = cosmeticsFor(db, '2026-06-02');
    expect(out.get('early')).toContain('gold_rims');
    expect(out.get('late') ?? []).not.toContain('gold_rims');
  });

  it('awards rookie_decal to the most-improved racer vs the prior day', () => {
    // yesterday
    addEvent(db, { id: 'commit:y1', login: 'devon-r', type: 'commit', points: 1, at: '2026-06-01T10:00:00.000Z', date: '2026-06-01' });
    addEvent(db, { id: 'commit:y2', login: 'mira-k', type: 'commit', points: 1, at: '2026-06-01T10:00:00.000Z', date: '2026-06-01' });
    // today: mira jumps by a merge (+8), devon stays flat (+1)
    addEvent(db, { id: 'commit:t1', login: 'devon-r', type: 'commit', points: 1, at: '2026-06-02T10:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'pr_merged:9', login: 'mira-k', type: 'pr_merged', points: 8, at: '2026-06-02T11:00:00.000Z', date: '2026-06-02' });
    const out = cosmeticsFor(db, '2026-06-02');
    expect(out.get('mira-k')).toContain('rookie_decal');
    expect(out.get('devon-r') ?? []).not.toContain('rookie_decal');
  });

  it('returns an empty map for a day with no events', () => {
    const out = cosmeticsFor(db, '2026-06-02');
    expect(out.size).toBe(0);
  });
});
