import type Database from 'better-sqlite3';
import { scoreFromBreakdown, EMPTY_BREAKDOWN } from '@racingshape/shared';
import type { ScoreBreakdown } from '@racingshape/shared';
import { breakdownByRacer } from '../db/repositories/events.js';
import { upsertDailyStats } from '../db/repositories/dailyStats.js';
import { insertSnapshot } from '../db/repositories/snapshots.js';
import { getMeta, setMeta } from '../db/repositories/pollMeta.js';
import { ingestEvents } from './ingest.js';
import { raceDateFor } from '../time/raceDate.js';
import type { RawActivityBatch } from './types.js';

export interface PollerDeps {
  db: Database.Database;
  clock: () => Date;
  pollIntervalMs: number;
  snapshotIntervalMs: number;
  /** Fetch the day's activity for a race date (wraps the client in production). */
  fetchBatch: (raceDate: string) => Promise<RawActivityBatch>;
  setTimer: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>;
  clearTimer: (handle: ReturnType<typeof setTimeout>) => void;
}

const MAX_BACKOFF_MS = 900_000; // 15 minutes
const META_LAST_POLLED = 'last_polled_at';
const META_LAST_SNAPSHOT = 'last_snapshot_at';

function isRateLimited(err: unknown): boolean {
  const status = (err as { status?: number }).status;
  if (status === 403 || status === 429) return true;
  const msg = String((err as { message?: string }).message ?? '').toLowerCase();
  return msg.includes('secondary rate') || msg.includes('rate limit');
}

export class Poller {
  /** Current backoff in ms; 0 means healthy. Exposed for tests/observability. */
  currentBackoffMs = 0;
  private handle: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(private readonly deps: PollerDeps) {}

  /** Start the interval loop. Re-arms itself; uses backoff delay when unhealthy. */
  start(): void {
    this.stopped = false;
    const tick = async () => {
      if (this.stopped) return;
      await this.pollOnce();
      if (this.stopped) return;
      const delay = this.currentBackoffMs > 0 ? this.currentBackoffMs : this.deps.pollIntervalMs;
      this.handle = this.deps.setTimer(tick, delay);
    };
    this.handle = this.deps.setTimer(tick, 0);
  }

  stop(): void {
    this.stopped = true;
    if (this.handle != null) {
      this.deps.clearTimer(this.handle);
      this.handle = null;
    }
  }

  async pollOnce(): Promise<void> {
    const { db, clock, fetchBatch, pollIntervalMs } = this.deps;
    const now = clock();
    const raceDate = raceDateFor(now);

    let batch: RawActivityBatch;
    try {
      batch = await fetchBatch(raceDate);
    } catch (err) {
      if (isRateLimited(err)) {
        this.currentBackoffMs =
          this.currentBackoffMs === 0
            ? pollIntervalMs
            : Math.min(this.currentBackoffMs * 2, MAX_BACKOFF_MS);
        return;
      }
      throw err;
    }

    // success: reset backoff
    this.currentBackoffMs = 0;

    ingestEvents(db, batch);
    this.recomputeDailyStats(raceDate);
    this.maybeSnapshot(raceDate, now);
    setMeta(db, META_LAST_POLLED, now.toISOString());
  }

  private recomputeDailyStats(raceDate: string): void {
    const { db } = this.deps;
    const map = breakdownByRacer(db, raceDate);
    let commits = 0;
    let prsOpened = 0;
    let prsMerged = 0;
    let issuesClosed = 0;
    for (const b of map.values()) {
      commits += b.commit;
      prsOpened += b.pr_opened;
      prsMerged += b.pr_merged;
      issuesClosed += b.issue_closed;
    }
    upsertDailyStats(db, { raceDate, commits, prsOpened, prsMerged, issuesClosed });
  }

  private maybeSnapshot(raceDate: string, now: Date): void {
    const { db, snapshotIntervalMs } = this.deps;
    const lastIso = getMeta(db, META_LAST_SNAPSHOT);
    const elapsed = lastIso ? now.getTime() - new Date(lastIso).getTime() : Infinity;
    if (elapsed < snapshotIntervalMs) return;
    this.snapshotNow(raceDate, now);
  }

  /** Capture a score snapshot for every racer with activity today. Also used by the reset scheduler. */
  snapshotNow(raceDate: string, now: Date): void {
    const { db } = this.deps;
    const map = breakdownByRacer(db, raceDate);
    const capturedAt = now.toISOString();
    for (const [login, breakdown] of map.entries()) {
      const b: ScoreBreakdown = breakdown ?? EMPTY_BREAKDOWN;
      insertSnapshot(db, raceDate, login, scoreFromBreakdown(b), capturedAt);
    }
    setMeta(db, META_LAST_SNAPSHOT, capturedAt);
  }
}
