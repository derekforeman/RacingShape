import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { buildRecap } from '../../src/services/recapService.js';

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

function addRacer(db: Database.Database, login: string) {
  db.prepare('INSERT OR IGNORE INTO racers(github_login, display_name, avatar_url, first_seen) VALUES (?,?,?,?)').run(
    login,
    login.toUpperCase(),
    `https://a/${login}.png`,
    '2026-06-01T00:00:00.000Z',
  );
}
function addEvent(db: Database.Database, e: { id: string; login: string; type: string; points: number; at: string; date: string }) {
  addRacer(db, e.login);
  db.prepare('INSERT OR IGNORE INTO events(id, racer_login, type, points, occurred_at, race_date) VALUES (?,?,?,?,?,?)').run(
    e.id, e.login, e.type, e.points, e.at, e.date,
  );
}
function addSnap(db: Database.Database, s: { login: string; score: number; at: string; date: string }) {
  db.prepare('INSERT OR IGNORE INTO race_snapshots(race_date, racer_login, score, captured_at) VALUES (?,?,?,?)').run(
    s.date, s.login, s.score, s.at,
  );
}

describe('buildRecap', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = freshDb();
  });

  it('builds a podium of the top 3 by score', () => {
    addEvent(db, { id: 'pr_merged:1', login: 'a', type: 'pr_merged', points: 8, at: '2026-06-02T10:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'pr_opened:2', login: 'b', type: 'pr_opened', points: 5, at: '2026-06-02T10:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'issue_closed:3', login: 'c', type: 'issue_closed', points: 3, at: '2026-06-02T10:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'commit:4', login: 'd', type: 'commit', points: 1, at: '2026-06-02T10:00:00.000Z', date: '2026-06-02' });

    const recap = buildRecap(db, '2026-06-02');
    expect(recap.podium.map((p) => p.login)).toEqual(['a', 'b', 'c']);
    expect(recap.podium[0]).toMatchObject({ position: 1, score: 8 });
    expect(recap.podium[0]!.breakdown.pr_merged).toBe(1);
  });

  it('fastest_hour picks the racer with the most points in any 60-min window', () => {
    // a: 3 commits within an hour (3 pts). b: a single 8-pt merge (8 pts in its own window).
    addEvent(db, { id: 'commit:a1', login: 'a', type: 'commit', points: 1, at: '2026-06-02T14:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'commit:a2', login: 'a', type: 'commit', points: 1, at: '2026-06-02T14:20:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'commit:a3', login: 'a', type: 'commit', points: 1, at: '2026-06-02T14:40:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'pr_merged:7', login: 'b', type: 'pr_merged', points: 8, at: '2026-06-02T16:00:00.000Z', date: '2026-06-02' });

    const recap = buildRecap(db, '2026-06-02');
    const fh = recap.superlatives.find((s) => s.key === 'fastest_hour')!;
    expect(fh.login).toBe('b');
  });

  it('midnight_grinder is the author of the latest event', () => {
    addEvent(db, { id: 'commit:e', login: 'early', type: 'commit', points: 1, at: '2026-06-02T09:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'commit:l', login: 'nightowl', type: 'commit', points: 1, at: '2026-06-02T23:45:00.000Z', date: '2026-06-02' });
    const recap = buildRecap(db, '2026-06-02');
    const mg = recap.superlatives.find((s) => s.key === 'midnight_grinder')!;
    expect(mg.login).toBe('nightowl');
  });

  it('comeback is the biggest second-half climb from snapshots', () => {
    // a flat all day; b surges after midday.
    addSnap(db, { login: 'a', score: 5, at: '2026-06-02T12:00:00.000Z', date: '2026-06-02' });
    addSnap(db, { login: 'b', score: 1, at: '2026-06-02T12:00:00.000Z', date: '2026-06-02' });
    addSnap(db, { login: 'a', score: 6, at: '2026-06-02T23:00:00.000Z', date: '2026-06-02' });
    addSnap(db, { login: 'b', score: 14, at: '2026-06-02T23:00:00.000Z', date: '2026-06-02' });
    const recap = buildRecap(db, '2026-06-02');
    const cb = recap.superlatives.find((s) => s.key === 'comeback')!;
    expect(cb.login).toBe('b');
  });

  it('superlatives have null login when no data supports them', () => {
    const recap = buildRecap(db, '2026-06-02');
    expect(recap.podium).toEqual([]);
    expect(recap.superlatives.map((s) => s.key)).toEqual(['fastest_hour', 'comeback', 'midnight_grinder']);
    for (const s of recap.superlatives) expect(s.login).toBeNull();
  });
});
