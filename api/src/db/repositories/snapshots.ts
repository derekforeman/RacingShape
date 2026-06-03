import type { SnapshotFrame } from '@racingshape/shared';
import type { Db } from '../connection.js';

export function insertSnapshot(
  db: Db,
  raceDate: string,
  login: string,
  score: number,
  capturedAt: string,
): void {
  db.prepare(
    `INSERT OR IGNORE INTO race_snapshots (race_date, racer_login, score, captured_at)
     VALUES (?, ?, ?, ?)`,
  ).run(raceDate, login, score, capturedAt);
}

/** All snapshot frames for a day, ordered by capturedAt asc; scores within a frame by login asc. */
export function framesForDate(db: Db, raceDate: string): SnapshotFrame[] {
  const rows = db
    .prepare(
      `SELECT captured_at AS capturedAt, racer_login AS login, score
       FROM race_snapshots
       WHERE race_date = ?
       ORDER BY captured_at ASC, racer_login ASC`,
    )
    .all(raceDate) as { capturedAt: string; login: string; score: number }[];

  const frames: SnapshotFrame[] = [];
  let current: SnapshotFrame | undefined;
  for (const row of rows) {
    if (!current || current.capturedAt !== row.capturedAt) {
      current = { capturedAt: row.capturedAt, scores: [] };
      frames.push(current);
    }
    current.scores.push({ login: row.login, score: row.score });
  }
  return frames;
}

/** Scores from the most recent frame for the day, keyed by login. */
export function latestScores(db: Db, raceDate: string): Map<string, number> {
  const latest = db
    .prepare(`SELECT MAX(captured_at) AS capturedAt FROM race_snapshots WHERE race_date = ?`)
    .get(raceDate) as { capturedAt: string | null } | undefined;

  const map = new Map<string, number>();
  if (!latest || latest.capturedAt === null) return map;

  const rows = db
    .prepare(
      `SELECT racer_login AS login, score
       FROM race_snapshots
       WHERE race_date = ? AND captured_at = ?`,
    )
    .all(raceDate, latest.capturedAt) as { login: string; score: number }[];

  for (const row of rows) map.set(row.login, row.score);
  return map;
}
