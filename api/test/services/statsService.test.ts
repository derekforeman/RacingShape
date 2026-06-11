import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { getStats } from '../../src/services/statsService.js';
import type { AppConfig } from '../../src/config.js';

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}
const config: AppConfig = {
  port: 8787, githubToken: 'x', repoOwner: 'S2AI', repoName: 's2shape',
  pollIntervalMs: 60000, snapshotIntervalMs: 300000, dbPath: ':memory:', geoEnabled: false,
};
function addDaily(db: Database.Database, r: { date: string; commits?: number; prsOpened?: number; prsMerged?: number; issuesClosed?: number }) {
  db.prepare('INSERT OR REPLACE INTO daily_stats(race_date, commits, prs_opened, prs_merged, issues_closed) VALUES (?,?,?,?,?)').run(
    r.date, r.commits ?? 0, r.prsOpened ?? 0, r.prsMerged ?? 0, r.issuesClosed ?? 0,
  );
}
function addEvent(db: Database.Database, date: string, at: string, id: string) {
  db.prepare('INSERT OR IGNORE INTO events(id, racer_login, type, points, occurred_at, race_date) VALUES (?,?,?,?,?,?)').run(
    id, 'a', 'commit', 1, at, date,
  );
}

describe('getStats', () => {
  let db: Database.Database;
  const now = new Date('2026-06-02T15:00:00.000Z'); // today = 2026-06-02
  beforeEach(() => {
    db = freshDb();
  });

  it('returns repoUrl from config and echoes the range', () => {
    const s = getStats(db, '14d', now, config);
    expect(s.repoUrl).toBe('https://github.com/S2AI/s2shape');
    expect(s.range).toBe('14d');
  });

  it('builds the chart ascending by date within range', () => {
    addDaily(db, { date: '2026-06-01', commits: 3, prsOpened: 1, issuesClosed: 2 });
    addDaily(db, { date: '2026-06-02', commits: 5, prsOpened: 2, issuesClosed: 0 });
    const s = getStats(db, '14d', now, config);
    expect(s.chart.map((c) => c.raceDate)).toEqual(['2026-06-01', '2026-06-02']);
    expect(s.chart[1]).toEqual({ raceDate: '2026-06-02', commits: 5, prsOpened: 2, issuesClosed: 0 });
  });

  it('computes totalTasks as issues + prs', () => {
    addDaily(db, { date: '2026-06-02', prsOpened: 4, issuesClosed: 6 });
    const s = getStats(db, '14d', now, config);
    expect(s.totalTasks).toMatchObject({ issues: 6, prs: 4, total: 10 });
  });

  it('computes completion rate as closed / opened', () => {
    addDaily(db, { date: '2026-06-02', prsOpened: 4, prsMerged: 2, issuesClosed: 1 });
    const s = getStats(db, '14d', now, config);
    expect(s.completion.opened).toBe(4);
    expect(s.completion.closed).toBe(3); // merged + issues_closed
    expect(s.completion.rate).toBeCloseTo(0.75);
  });

  it('completion rate is 0 when nothing was opened', () => {
    const s = getStats(db, '14d', now, config);
    expect(s.completion.rate).toBe(0);
  });

  it('computes a streak of consecutive event days ending today', () => {
    addEvent(db, '2026-05-31', '2026-05-31T10:00:00.000Z', 'commit:1');
    addEvent(db, '2026-06-01', '2026-06-01T10:00:00.000Z', 'commit:2');
    addEvent(db, '2026-06-02', '2026-06-02T10:00:00.000Z', 'commit:3');
    const s = getStats(db, '14d', now, config);
    expect(s.streak.current).toBe(3);
    expect(s.streak.startDate).toBe('2026-05-31');
  });

  it('streak is 0 when today has no events', () => {
    addEvent(db, '2026-05-31', '2026-05-31T10:00:00.000Z', 'commit:1');
    const s = getStats(db, '14d', now, config);
    expect(s.streak.current).toBe(0);
    expect(s.streak.startDate).toBeNull();
  });

  it('handles an empty range', () => {
    const s = getStats(db, '14d', now, config);
    expect(s.chart).toEqual([]);
    expect(s.totalTasks.total).toBe(0);
  });
});
