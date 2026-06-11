import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../src/db/migrate.js';
import { upsertViewerPeak } from '../../src/db/repositories/viewerPeaks.js';
import { getStats } from '../../src/services/statsService.js';
import type { AppConfig } from '../../src/config.js';

const config: AppConfig = {
  port: 8787, githubToken: 'x', repoOwner: 'S2AI', repoName: 's2shape',
  pollIntervalMs: 60000, snapshotIntervalMs: 300000, dbPath: ':memory:', geoEnabled: false,
};

describe('getStats crowd', () => {
  it('includes peakToday and a chronological peaks series aligned with the date range', () => {
    const db = new Database(':memory:');
    migrate(db);
    upsertViewerPeak(db, '2026-06-09', 4, '2026-06-09T14:00:00.000Z');
    upsertViewerPeak(db, '2026-06-10', 7, '2026-06-10T14:00:00.000Z');

    // clock: 2026-06-10T18:00Z → NY race date = 2026-06-10
    const now = new Date('2026-06-10T18:00:00.000Z');
    const stats = getStats(db, '14d', now, config);

    expect(stats.crowd.peakToday).toBe(7);
    // peaks is chronological; last entry should be today
    expect(stats.crowd.peaks.at(-1)).toEqual({ date: '2026-06-10', peak: 7 });
    // 2026-06-09 should appear with its recorded peak
    expect(stats.crowd.peaks.find((p) => p.date === '2026-06-09')).toEqual({ date: '2026-06-09', peak: 4 });
    // dates with no recorded peak should be 0 (sparse fill)
    expect(stats.crowd.peaks.find((p) => p.date === '2026-06-08')).toEqual({ date: '2026-06-08', peak: 0 });
    // the series should cover the full 14-day window (today - 13d through today)
    expect(stats.crowd.peaks).toHaveLength(14);
    // series must be in ascending date order
    const dates = stats.crowd.peaks.map((p) => p.date);
    expect(dates).toEqual([...dates].sort());
  });

  it('returns peakToday = 0 when no peak recorded for today', () => {
    const db = new Database(':memory:');
    migrate(db);
    const now = new Date('2026-06-10T18:00:00.000Z');
    const stats = getStats(db, '14d', now, config);
    expect(stats.crowd.peakToday).toBe(0);
    expect(stats.crowd.peaks.every((p) => p.peak === 0)).toBe(true);
  });
});
