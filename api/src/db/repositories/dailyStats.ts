import type { Db } from '../connection.js';

export interface DailyStatsRow {
  raceDate: string;
  commits: number;
  prsOpened: number;
  prsMerged: number;
  issuesClosed: number;
}

interface DbRow {
  race_date: string;
  commits: number;
  prs_opened: number;
  prs_merged: number;
  issues_closed: number;
}

function toRow(r: DbRow): DailyStatsRow {
  return {
    raceDate: r.race_date,
    commits: r.commits,
    prsOpened: r.prs_opened,
    prsMerged: r.prs_merged,
    issuesClosed: r.issues_closed,
  };
}

/** Insert or replace the aggregate counts for a day. */
export function upsertDailyStats(db: Db, row: DailyStatsRow): void {
  db.prepare(
    `INSERT INTO daily_stats (race_date, commits, prs_opened, prs_merged, issues_closed)
     VALUES (@raceDate, @commits, @prsOpened, @prsMerged, @issuesClosed)
     ON CONFLICT(race_date) DO UPDATE SET
       commits       = excluded.commits,
       prs_opened    = excluded.prs_opened,
       prs_merged    = excluded.prs_merged,
       issues_closed = excluded.issues_closed`,
  ).run(row);
}

/** Daily stats rows for an inclusive [start, end] date range, ascending by date. */
export function getRange(db: Db, start: string, end: string): DailyStatsRow[] {
  const rows = db
    .prepare(
      `SELECT * FROM daily_stats
       WHERE race_date >= ? AND race_date <= ?
       ORDER BY race_date ASC`,
    )
    .all(start, end) as DbRow[];
  return rows.map(toRow);
}
