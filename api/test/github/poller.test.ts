import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { Poller, type PollerDeps } from '../../src/github/poller.js';
import type { RawActivityBatch } from '../../src/github/types.js';
import { getMeta } from '../../src/db/repositories/pollMeta.js';

function freshDb() {
  const db = new Database(':memory:');
  migrate(db);
  return db;
}

const author = { login: 'devon-r', displayName: 'Devon R', avatarUrl: 'https://a/d.png' };

function deps(over: Partial<PollerDeps> = {}): { db: Database.Database; d: PollerDeps; now: { v: Date } } {
  const db = freshDb();
  const now = { v: new Date('2026-06-02T15:00:00.000Z') };
  const d: PollerDeps = {
    db,
    clock: () => now.v,
    snapshotIntervalMs: 300_000,
    pollIntervalMs: 60_000,
    fetchBatch: async (raceDate) =>
      ({ raceDate, activities: [{ type: 'commit', nativeId: 's1', author, occurredAt: '2026-06-02T15:00:00.000Z' }] } as RawActivityBatch),
    setTimer: () => 0 as unknown as ReturnType<typeof setTimeout>,
    clearTimer: () => {},
    ...over,
  };
  return { db, d, now };
}

describe('Poller.pollOnce', () => {
  let ctx: ReturnType<typeof deps>;
  beforeEach(() => {
    ctx = deps();
  });

  it('ingests fetched activity and records last_polled_at', async () => {
    const p = new Poller(ctx.d);
    await p.pollOnce();
    const n = ctx.db.prepare('SELECT COUNT(*) AS n FROM events').get() as any;
    expect(n.n).toBe(1);
    expect(getMeta(ctx.db, 'last_polled_at')).toBe('2026-06-02T15:00:00.000Z');
  });

  it('recomputes daily_stats for the race date', async () => {
    const p = new Poller(ctx.d);
    await p.pollOnce();
    const ds = ctx.db.prepare('SELECT * FROM daily_stats WHERE race_date = ?').get('2026-06-02') as any;
    expect(ds.commits).toBe(1);
    expect(ds.prs_opened).toBe(0);
  });

  it('writes a snapshot on first poll, then gates by snapshotIntervalMs', async () => {
    const p = new Poller(ctx.d);
    await p.pollOnce(); // first poll -> snapshot
    let snaps = ctx.db.prepare('SELECT COUNT(*) AS n FROM race_snapshots').get() as any;
    expect(snaps.n).toBe(1);

    // 2 minutes later: under the 5-min cadence -> no new snapshot
    ctx.now.v = new Date('2026-06-02T15:02:00.000Z');
    await p.pollOnce();
    snaps = ctx.db.prepare('SELECT COUNT(*) AS n FROM race_snapshots').get() as any;
    expect(snaps.n).toBe(1);

    // 6 minutes after the first: cadence elapsed -> new snapshot
    ctx.now.v = new Date('2026-06-02T15:06:00.000Z');
    await p.pollOnce();
    snaps = ctx.db.prepare('SELECT COUNT(*) AS n FROM race_snapshots').get() as any;
    expect(snaps.n).toBe(2);
  });

  it('backs off on a 403 and does not crash; backoff doubles capped', async () => {
    const fail = deps({
      fetchBatch: async () => {
        const e: any = new Error('rate limited');
        e.status = 403;
        throw e;
      },
    });
    const p = new Poller(fail.d);
    expect(p.currentBackoffMs).toBe(0);
    await p.pollOnce();
    expect(p.currentBackoffMs).toBe(60_000); // first backoff = pollIntervalMs
    await p.pollOnce();
    expect(p.currentBackoffMs).toBe(120_000); // doubled
    // cap check: many failures never exceed 15 min
    for (let i = 0; i < 10; i++) await p.pollOnce();
    expect(p.currentBackoffMs).toBe(900_000);
    // no events ingested while failing
    const n = fail.db.prepare('SELECT COUNT(*) AS n FROM events').get() as any;
    expect(n.n).toBe(0);
  });

  it('resets backoff after a successful poll', async () => {
    let shouldFail = true;
    const flaky = deps({
      fetchBatch: async (raceDate) => {
        if (shouldFail) {
          const e: any = new Error('rate limited');
          e.status = 403;
          throw e;
        }
        return { raceDate, activities: [] };
      },
    });
    const p = new Poller(flaky.d);
    await p.pollOnce();
    expect(p.currentBackoffMs).toBe(60_000);
    shouldFail = false;
    await p.pollOnce();
    expect(p.currentBackoffMs).toBe(0);
  });
});
