import type { ArchivedReaction, ReactionKind, ReactionSummary } from '@racingshape/shared';
import type { Db } from '../connection.js';

export interface ReactionRow {
  id: string;
  raceDate: string;
  targetLogin: string;
  kind: ReactionKind;
  reactor: string;
  createdAt: string; // ISO UTC
}

const ZERO_BY_KIND = (): Record<ReactionKind, number> => ({ '🔥': 0, '⚡': 0, '🏎️': 0 });

export function insertReaction(db: Db, r: ReactionRow): void {
  db.prepare(
    `INSERT OR IGNORE INTO reactions (id, race_date, target_racer_login, kind, reactor, created_at)
     VALUES (@id, @raceDate, @targetLogin, @kind, @reactor, @createdAt)`,
  ).run(r);
}

/** Reaction totals + per-kind breakdown for one target on one day. */
export function summaryForDate(db: Db, raceDate: string, targetLogin: string): ReactionSummary {
  const rows = db
    .prepare(
      `SELECT kind, COUNT(*) AS n
       FROM reactions
       WHERE race_date = ? AND target_racer_login = ?
       GROUP BY kind`,
    )
    .all(raceDate, targetLogin) as { kind: ReactionKind; n: number }[];

  const byKind = ZERO_BY_KIND();
  let total = 0;
  for (const row of rows) {
    byKind[row.kind] = row.n;
    total += row.n;
  }
  return { total, byKind };
}

/** Per-target reaction summaries for a day, keyed by target login (all targets at once). */
export function summariesForDate(db: Db, raceDate: string): Map<string, ReactionSummary> {
  const rows = db
    .prepare(
      `SELECT target_racer_login AS login, kind, COUNT(*) AS n
       FROM reactions
       WHERE race_date = ?
       GROUP BY target_racer_login, kind`,
    )
    .all(raceDate) as { login: string; kind: ReactionKind; n: number }[];

  const map = new Map<string, ReactionSummary>();
  for (const row of rows) {
    let summary = map.get(row.login);
    if (!summary) {
      summary = { total: 0, byKind: ZERO_BY_KIND() };
      map.set(row.login, summary);
    }
    summary.byKind[row.kind] = row.n;
    summary.total += row.n;
  }
  return map;
}

/** All reactions for a day, ordered by createdAt asc (for archive/replay). */
export function listForDate(db: Db, raceDate: string): ArchivedReaction[] {
  const rows = db
    .prepare(
      `SELECT target_racer_login AS targetLogin, kind, reactor, created_at AS createdAt
       FROM reactions
       WHERE race_date = ?
       ORDER BY created_at ASC`,
    )
    .all(raceDate) as ArchivedReaction[];
  return rows;
}
