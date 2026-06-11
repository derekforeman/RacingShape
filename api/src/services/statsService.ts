import type Database from 'better-sqlite3';
import type { StatsResponse, ChartDay, TasksStat, CompletionStat, StreakStat } from '@racingshape/shared';
import type { AppConfig } from '../config.js';
import { getRange } from '../db/repositories/dailyStats.js';
import { raceDateFor } from '../time/raceDate.js';

function parseRangeDays(range: string): number {
  const m = /^(\d+)d$/.exec(range.trim());
  const n = m ? Number(m[1]) : 14;
  return n > 0 ? n : 14;
}

/** Shift a YYYY-MM-DD key by `delta` days (negative = earlier). */
function shiftDateKey(date: string, delta: number): string {
  const [y, m, d] = date.split('-');
  const dt = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}

export function getStats(db: Database.Database, range: string, now: Date, config: AppConfig): StatsResponse {
  const days = parseRangeDays(range);
  const today = raceDateFor(now);
  const fromDate = shiftDateKey(today, -(days - 1));

  const rows = getRange(db, fromDate, today); // ascending by date (plan-01 guarantee)
  const chart: ChartDay[] = rows.map((r) => ({
    raceDate: r.raceDate,
    commits: r.commits,
    prsOpened: r.prsOpened,
    issuesClosed: r.issuesClosed,
  }));

  const issues = sum(rows, (r) => r.issuesClosed);
  const prs = sum(rows, (r) => r.prsOpened);
  const merged = sum(rows, (r) => r.prsMerged);

  const totalTasks: TasksStat = {
    issues,
    prs,
    total: issues + prs,
    deltaVsPriorWeek: weeklyDelta(db, today),
  };

  const opened = prs;
  const closed = merged + issues;
  const completion: CompletionStat = {
    opened,
    closed,
    rate: opened > 0 ? closed / opened : 0,
  };

  return {
    range,
    repoUrl: `https://github.com/${config.repoOwner}/${config.repoName}`,
    chart,
    totalTasks,
    completion,
    streak: computeStreak(db, today),
    crowd: { peakToday: 0, peaks: [] },
  };
}

function sum<T>(rows: T[], f: (r: T) => number): number {
  return rows.reduce((acc, r) => acc + f(r), 0);
}

/** (this 7d total tasks) − (prior 7d total tasks), signed. */
function weeklyDelta(db: Database.Database, today: string): number {
  const thisFrom = shiftDateKey(today, -6);
  const priorTo = shiftDateKey(today, -7);
  const priorFrom = shiftDateKey(today, -13);
  const thisRows = getRange(db, thisFrom, today);
  const priorRows = getRange(db, priorFrom, priorTo);
  const thisTotal = sum(thisRows, (r) => r.issuesClosed + r.prsOpened);
  const priorTotal = sum(priorRows, (r) => r.issuesClosed + r.prsOpened);
  return thisTotal - priorTotal;
}

/** True if `date` has >=1 event. */
function hasEvents(db: Database.Database, date: string): boolean {
  const row = db.prepare('SELECT 1 FROM events WHERE race_date = ? LIMIT 1').get(date) as unknown;
  return row != null;
}

function computeStreak(db: Database.Database, today: string): StreakStat {
  // current run ending today
  let current = 0;
  let cursor = today;
  let startDate: string | null = null;
  while (hasEvents(db, cursor)) {
    current += 1;
    startDate = cursor;
    cursor = shiftDateKey(cursor, -1);
  }

  // best run within the current calendar month (scan that month's days)
  const [y, m] = today.split('-');
  const daysInMonth = new Date(Date.UTC(Number(y), Number(m), 0)).getUTCDate();
  let best = 0;
  let run = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${y}-${m}-${String(d).padStart(2, '0')}`;
    if (hasEvents(db, key)) {
      run += 1;
      if (run > best) best = run;
    } else {
      run = 0;
    }
  }

  return { current, startDate, bestThisMonth: best };
}
