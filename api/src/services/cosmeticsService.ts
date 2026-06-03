import type Database from 'better-sqlite3';
import type { Cosmetic } from '@racingshape/shared';
import { scoreFromBreakdown } from '@racingshape/shared';
import { breakdownByRacer } from '../db/repositories/events.js';

const FLAME_STREAK_DAYS = 5;

/** Subtract one day from a YYYY-MM-DD key (UTC-safe arithmetic on the date key). */
function prevDateKey(date: string): string {
  const [y, m, d] = date.split('-');
  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  dt.setUTCDate(dt.getUTCDate() - 1);
  return dt.toISOString().slice(0, 10);
}

function add(map: Map<string, Cosmetic[]>, login: string, c: Cosmetic): void {
  const list = map.get(login) ?? [];
  if (!list.includes(c)) list.push(c);
  map.set(login, list);
}

/**
 * Earned cosmetics for `date` (DESIGN §5.3):
 *  - flame_trail: racer has a >=5-day consecutive-activity streak ending on `date`.
 *  - gold_rims:   author of the earliest pr_merged event that day (first merge).
 *  - rookie_decal: most-improved racer vs the prior day (largest positive score delta).
 */
export function cosmeticsFor(db: Database.Database, date: string): Map<string, Cosmetic[]> {
  const out = new Map<string, Cosmetic[]>();

  const todayScores = scoresByLogin(db, date);
  if (todayScores.size === 0) return out;

  // flame_trail
  for (const login of todayScores.keys()) {
    if (streakEndingOn(db, login, date) >= FLAME_STREAK_DAYS) add(out, login, 'flame_trail');
  }

  // gold_rims — earliest pr_merged that day
  const firstMerge = db
    .prepare(
      "SELECT racer_login AS login FROM events WHERE race_date = ? AND type = 'pr_merged' ORDER BY occurred_at ASC, racer_login ASC LIMIT 1",
    )
    .get(date) as { login: string } | undefined;
  if (firstMerge) add(out, firstMerge.login, 'gold_rims');

  // rookie_decal — most-improved vs prior day
  const prev = scoresByLogin(db, prevDateKey(date));
  let bestLogin: string | null = null;
  let bestDelta = 0;
  for (const [login, score] of todayScores.entries()) {
    const delta = score - (prev.get(login) ?? 0);
    if (delta > bestDelta || (delta === bestDelta && delta > 0 && (bestLogin === null || login < bestLogin))) {
      bestDelta = delta;
      bestLogin = login;
    }
  }
  if (bestLogin && bestDelta > 0) add(out, bestLogin, 'rookie_decal');

  return out;
}

function scoresByLogin(db: Database.Database, date: string): Map<string, number> {
  const m = breakdownByRacer(db, date);
  const out = new Map<string, number>();
  for (const [login, b] of m.entries()) out.set(login, scoreFromBreakdown(b));
  return out;
}

/** Length of the consecutive-day activity streak for `login` ending on `date` (inclusive). */
function streakEndingOn(db: Database.Database, login: string, date: string): number {
  const stmt = db.prepare('SELECT COUNT(*) AS n FROM events WHERE racer_login = ? AND race_date = ?');
  let streak = 0;
  let cursor = date;
  for (;;) {
    const row = stmt.get(login, cursor) as { n: number };
    if (row.n === 0) break;
    streak += 1;
    cursor = prevDateKey(cursor);
  }
  return streak;
}
