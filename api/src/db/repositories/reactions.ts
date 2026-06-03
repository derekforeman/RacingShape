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
