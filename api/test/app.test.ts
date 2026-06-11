import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import { migrate } from '../src/db/migrate.js';
import { createApp, type AppDeps } from '../src/app.js';
import type { AppConfig } from '../src/config.js';

const config: AppConfig = {
  port: 8787, githubToken: 'super-secret-token-xyz', repoOwner: 'S2AI', repoName: 's2shape',
  pollIntervalMs: 60000, snapshotIntervalMs: 300000, dbPath: ':memory:', geoEnabled: false,
};

function seedDb(): Database.Database {
  const db = new Database(':memory:');
  migrate(db);
  db.prepare('INSERT INTO racers(github_login, display_name, avatar_url, first_seen) VALUES (?,?,?,?)').run(
    'a', 'A', 'https://a/a.png', '2026-06-01T00:00:00.000Z',
  );
  db.prepare('INSERT INTO racers(github_login, display_name, avatar_url, first_seen) VALUES (?,?,?,?)').run(
    'b', 'B', 'https://a/b.png', '2026-06-01T00:00:00.000Z',
  );
  // today (2026-06-02) events
  db.prepare('INSERT INTO events(id, racer_login, type, points, occurred_at, race_date) VALUES (?,?,?,?,?,?)').run(
    'pr_merged:1', 'a', 'pr_merged', 8, '2026-06-02T10:00:00.000Z', '2026-06-02',
  );
  db.prepare('INSERT INTO events(id, racer_login, type, points, occurred_at, race_date) VALUES (?,?,?,?,?,?)').run(
    'commit:2', 'b', 'commit', 1, '2026-06-02T10:00:00.000Z', '2026-06-02',
  );
  db.prepare('INSERT INTO poll_meta(key, value) VALUES (?,?)').run('last_polled_at', '2026-06-02T15:00:00.000Z');
  // archived day 2026-06-01
  db.prepare('INSERT INTO events(id, racer_login, type, points, occurred_at, race_date) VALUES (?,?,?,?,?,?)').run(
    'pr_merged:9', 'a', 'pr_merged', 8, '2026-06-01T10:00:00.000Z', '2026-06-01',
  );
  db.prepare('INSERT INTO race_snapshots(race_date, racer_login, score, captured_at) VALUES (?,?,?,?)').run(
    '2026-06-01', 'a', 8, '2026-06-01T23:00:00.000Z',
  );
  // daily_stats for chart
  db.prepare('INSERT INTO daily_stats(race_date, commits, prs_opened, prs_merged, issues_closed) VALUES (?,?,?,?,?)').run(
    '2026-06-02', 1, 0, 1, 0,
  );
  return db;
}

function makeApp(db: Database.Database) {
  const deps: AppDeps = { db, config, clock: () => new Date('2026-06-02T15:00:00.000Z') };
  return createApp(deps);
}

describe('API integration', () => {
  let db: Database.Database;
  beforeEach(() => {
    db = seedDb();
  });

  it('GET /api/race/today returns live standings', async () => {
    const res = await request(makeApp(db)).get('/api/race/today');
    expect(res.status).toBe(200);
    expect(res.body.live).toBe(true);
    expect(res.body.raceDate).toBe('2026-06-02');
    expect(res.body.standings[0].login).toBe('a');
    expect(res.body.topScore).toBe(8);
  });

  it('GET /api/race/:date returns an archive', async () => {
    const res = await request(makeApp(db)).get('/api/race/2026-06-01');
    expect(res.status).toBe(200);
    expect(res.body.live).toBe(false);
    expect(res.body.raceDate).toBe('2026-06-01');
    expect(res.body.recap.podium[0].login).toBe('a');
  });

  it('GET /api/race/:date 404s for an unknown date', async () => {
    const res = await request(makeApp(db)).get('/api/race/1999-01-01');
    expect(res.status).toBe(404);
  });

  it('GET /api/races lists archived dates', async () => {
    const res = await request(makeApp(db)).get('/api/races');
    expect(res.status).toBe(200);
    expect(res.body.map((r: any) => r.raceDate)).toContain('2026-06-01');
  });

  it('GET /api/stats returns chart + sidebar shapes', async () => {
    const res = await request(makeApp(db)).get('/api/stats?range=14d');
    expect(res.status).toBe(200);
    expect(res.body.repoUrl).toBe('https://github.com/S2AI/s2shape');
    expect(Array.isArray(res.body.chart)).toBe(true);
    expect(res.body.totalTasks).toBeDefined();
    expect(res.body.streak).toBeDefined();
  });

  it('POST /api/race/today/reactions increments the target summary', async () => {
    const res = await request(makeApp(db))
      .post('/api/race/today/reactions')
      .send({ targetLogin: 'a', kind: '🔥', reactor: 'mira-k' });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.reactions.total).toBe(1);
    expect(res.body.reactions.byKind['🔥']).toBe(1);
  });

  it('POST /api/race/today/reactions 400s on an invalid body', async () => {
    const res = await request(makeApp(db))
      .post('/api/race/today/reactions')
      .send({ targetLogin: 'a', kind: 'nope', reactor: 'mira-k' });
    expect(res.status).toBe(400);
  });

  it('never serializes the github token in any response', async () => {
    const endpoints = ['/api/race/today', '/api/race/2026-06-01', '/api/races', '/api/stats?range=14d'];
    for (const e of endpoints) {
      const res = await request(makeApp(db)).get(e);
      expect(JSON.stringify(res.body)).not.toContain('super-secret-token-xyz');
    }
  });
});
