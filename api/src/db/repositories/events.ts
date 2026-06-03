import type { EventType, ScoreBreakdown } from '@racingshape/shared';
import { EMPTY_BREAKDOWN } from '@racingshape/shared';
import type { Db } from '../connection.js';

export interface EventRow {
  id: string;
  racerLogin: string;
  type: EventType;
  points: number;
  occurredAt: string; // ISO UTC
  raceDate: string; // YYYY-MM-DD (NY)
}

/** Insert events, ignoring duplicates by primary-key id. Idempotent re-poll. */
export function insertEventsIgnore(db: Db, events: EventRow[]): void {
  if (events.length === 0) return;
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO events (id, racer_login, type, points, occurred_at, race_date)
     VALUES (@id, @racerLogin, @type, @points, @occurredAt, @raceDate)`,
  );
  const insertMany = db.transaction((rows: EventRow[]) => {
    for (const r of rows) stmt.run(r);
  });
  insertMany(events);
}

/** Per-racer count of each event type for a single race_date. */
export function breakdownByRacer(db: Db, raceDate: string): Map<string, ScoreBreakdown> {
  const rows = db
    .prepare(
      `SELECT racer_login AS login, type, COUNT(*) AS n
       FROM events
       WHERE race_date = ?
       GROUP BY racer_login, type`,
    )
    .all(raceDate) as { login: string; type: EventType; n: number }[];

  const map = new Map<string, ScoreBreakdown>();
  for (const row of rows) {
    let b = map.get(row.login);
    if (!b) {
      b = { ...EMPTY_BREAKDOWN };
      map.set(row.login, b);
    }
    b[row.type] = row.n;
  }
  return map;
}

/** Aggregate count per event type across an inclusive [start, end] date range. */
export function countsForRange(db: Db, start: string, end: string): ScoreBreakdown {
  const rows = db
    .prepare(
      `SELECT type, COUNT(*) AS n
       FROM events
       WHERE race_date >= ? AND race_date <= ?
       GROUP BY type`,
    )
    .all(start, end) as { type: EventType; n: number }[];

  const out: ScoreBreakdown = { ...EMPTY_BREAKDOWN };
  for (const row of rows) {
    out[row.type] = row.n;
  }
  return out;
}
