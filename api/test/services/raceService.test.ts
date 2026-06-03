import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { getToday, getArchive, listRaces } from '../../src/services/raceService.js';

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}
function addRacer(db: Database.Database, login: string) {
  db.prepare('INSERT OR IGNORE INTO racers(github_login, display_name, avatar_url, first_seen) VALUES (?,?,?,?)').run(
    login, login.toUpperCase(), `https://a/${login}.png`, '2026-06-01T00:00:00.000Z',
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

describe('raceService', () => {
  let db: Database.Database;
  const now = new Date('2026-06-02T15:00:00.000Z'); // race_date 2026-06-02
  beforeEach(() => {
    db = freshDb();
  });

  it('getToday returns standings, topScore>=1, and lastPolledAt', () => {
    addEvent(db, { id: 'pr_merged:1', login: 'a', type: 'pr_merged', points: 8, at: '2026-06-02T10:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'commit:2', login: 'b', type: 'commit', points: 1, at: '2026-06-02T10:00:00.000Z', date: '2026-06-02' });
    db.prepare('INSERT INTO poll_meta(key, value) VALUES (?,?)').run('last_polled_at', '2026-06-02T15:00:00.000Z');

    const today = getToday(db, now);
    expect(today.live).toBe(true);
    expect(today.raceDate).toBe('2026-06-02');
    expect(today.topScore).toBe(8);
    expect(today.lastPolledAt).toBe('2026-06-02T15:00:00.000Z');
    expect(today.standings[0]!.login).toBe('a');
    expect(today.standings[0]!.isLeader).toBe(true);
  });

  it('getToday floors topScore to 1 on an empty day', () => {
    const today = getToday(db, now);
    expect(today.topScore).toBe(1);
    expect(today.standings).toEqual([]);
    expect(today.lastPolledAt).toBeNull();
  });

  it('getToday marks the biggest gainer between the last two snapshots as topMover', () => {
    addEvent(db, { id: 'commit:a', login: 'a', type: 'commit', points: 1, at: '2026-06-02T10:00:00.000Z', date: '2026-06-02' });
    addEvent(db, { id: 'pr_merged:9', login: 'b', type: 'pr_merged', points: 8, at: '2026-06-02T14:00:00.000Z', date: '2026-06-02' });
    addSnap(db, { login: 'a', score: 1, at: '2026-06-02T12:00:00.000Z', date: '2026-06-02' });
    addSnap(db, { login: 'b', score: 0, at: '2026-06-02T12:00:00.000Z', date: '2026-06-02' });
    addSnap(db, { login: 'a', score: 1, at: '2026-06-02T14:30:00.000Z', date: '2026-06-02' });
    addSnap(db, { login: 'b', score: 8, at: '2026-06-02T14:30:00.000Z', date: '2026-06-02' });

    const today = getToday(db, now);
    const b = today.standings.find((s) => s.login === 'b')!;
    expect(b.topMover).toBe(true);
  });

  it('getArchive returns final standings, frames, reactions, and recap', () => {
    addEvent(db, { id: 'pr_merged:1', login: 'a', type: 'pr_merged', points: 8, at: '2026-06-01T10:00:00.000Z', date: '2026-06-01' });
    addSnap(db, { login: 'a', score: 8, at: '2026-06-01T23:00:00.000Z', date: '2026-06-01' });
    db.prepare('INSERT INTO reactions(id, race_date, target_racer_login, kind, reactor, created_at) VALUES (?,?,?,?,?,?)').run(
      'r1', '2026-06-01', 'a', '🔥', 'mira-k', '2026-06-01T11:00:00.000Z',
    );

    const arch = getArchive(db, '2026-06-01');
    expect(arch.live).toBe(false);
    expect(arch.raceDate).toBe('2026-06-01');
    expect(arch.topScore).toBe(8);
    expect(arch.standings[0]!.login).toBe('a');
    expect(arch.frames.length).toBe(1);
    expect(arch.reactions[0]!.targetLogin).toBe('a');
    expect(arch.recap.podium[0]!.login).toBe('a');
  });

  it('listRaces lists archived dates newest-first with winner + topScore', () => {
    addSnap(db, { login: 'a', score: 8, at: '2026-05-31T23:00:00.000Z', date: '2026-05-31' });
    addSnap(db, { login: 'b', score: 3, at: '2026-05-31T23:00:00.000Z', date: '2026-05-31' });
    addSnap(db, { login: 'c', score: 5, at: '2026-06-01T23:00:00.000Z', date: '2026-06-01' });
    addEvent(db, { id: 'pr_merged:1', login: 'a', type: 'pr_merged', points: 8, at: '2026-05-31T10:00:00.000Z', date: '2026-05-31' });
    addEvent(db, { id: 'pr_opened:2', login: 'b', type: 'pr_opened', points: 5, at: '2026-05-31T10:00:00.000Z', date: '2026-05-31' });
    addEvent(db, { id: 'pr_opened:3', login: 'c', type: 'pr_opened', points: 5, at: '2026-06-01T10:00:00.000Z', date: '2026-06-01' });

    const races = listRaces(db);
    expect(races.map((r) => r.raceDate)).toEqual(['2026-06-01', '2026-05-31']);
    expect(races[0]).toMatchObject({ raceDate: '2026-06-01', winnerLogin: 'c' });
    expect(races[1]).toMatchObject({ raceDate: '2026-05-31', winnerLogin: 'a' });
  });
});
