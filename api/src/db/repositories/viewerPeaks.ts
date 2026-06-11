import type { Db } from '../connection.js';

export interface ViewerPeak { peakCount: number; peakAt: string; }

/** Fetch peak counts for multiple race dates; returns a Map<raceDate, peakCount>. */
export function listViewerPeaks(db: Db, raceDates: string[]): Map<string, number> {
  if (raceDates.length === 0) return new Map();
  const placeholders = raceDates.map(() => '?').join(',');
  const rows = db
    .prepare(`SELECT race_date AS date, peak_count AS peak FROM viewer_peaks WHERE race_date IN (${placeholders})`)
    .all(...raceDates) as { date: string; peak: number }[];
  return new Map(rows.map((r) => [r.date, r.peak]));
}

export function getViewerPeak(db: Db, raceDate: string): ViewerPeak | null {
  const row = db
    .prepare('SELECT peak_count AS peakCount, peak_at AS peakAt FROM viewer_peaks WHERE race_date = ?')
    .get(raceDate) as ViewerPeak | undefined;
  return row ?? null;
}

/** Raise-only upsert: writes only when count exceeds the stored peak. */
export function upsertViewerPeak(db: Db, raceDate: string, peakCount: number, peakAt: string): void {
  db.prepare(
    `INSERT INTO viewer_peaks (race_date, peak_count, peak_at)
     VALUES (@raceDate, @peakCount, @peakAt)
     ON CONFLICT(race_date) DO UPDATE SET
       peak_count = excluded.peak_count,
       peak_at    = excluded.peak_at
     WHERE excluded.peak_count > viewer_peaks.peak_count`,
  ).run({ raceDate, peakCount, peakAt });
}
