import type Database from 'better-sqlite3';
import type { Recap, PodiumStep, Superlative, ScoreBreakdown } from '@racingshape/shared';
import { scoreFromBreakdown } from '@racingshape/shared';
import { breakdownByRacer, eventsForDate } from '../db/repositories/events.js';
import { framesForDate } from '../db/repositories/snapshots.js';
import { getRacer } from '../db/repositories/racers.js';

const HOUR_MS = 3_600_000;

export function buildRecap(db: Database.Database, date: string): Recap {
  return {
    raceDate: date,
    podium: buildPodium(db, date),
    superlatives: [fastestHour(db, date), comeback(db, date), midnightGrinder(db, date)],
  };
}

function buildPodium(db: Database.Database, date: string): PodiumStep[] {
  const map = breakdownByRacer(db, date);
  const scored = [...map.entries()]
    .map(([login, breakdown]) => ({ login, breakdown, score: scoreFromBreakdown(breakdown) }))
    .sort((a, b) => b.score - a.score || a.login.localeCompare(b.login))
    .slice(0, 3);

  return scored.map((s, i) => {
    const racer = getRacer(db, s.login);
    return {
      position: i + 1,
      login: s.login,
      displayName: racer?.displayName ?? s.login,
      avatarUrl: racer?.avatarUrl ?? '',
      score: s.score,
      breakdown: s.breakdown as ScoreBreakdown,
    };
  });
}

/** Most points in any rolling 60-min window, summed per racer. */
function fastestHour(db: Database.Database, date: string): Superlative {
  const events = eventsForDate(db, date)
    .map((e) => ({ login: e.racerLogin, points: e.points, t: new Date(e.occurredAt).getTime() }))
    .sort((a, b) => a.t - b.t);

  let bestLogin: string | null = null;
  let bestPoints = 0;
  let bestStart = 0;

  // For each event, the window [t, t+1h) anchored at that event; sum same-racer points within it.
  for (let i = 0; i < events.length; i++) {
    const start = events[i]!.t;
    const byLogin = new Map<string, number>();
    for (let j = i; j < events.length && events[j]!.t < start + HOUR_MS; j++) {
      const e = events[j]!;
      byLogin.set(e.login, (byLogin.get(e.login) ?? 0) + e.points);
    }
    for (const [login, pts] of byLogin.entries()) {
      if (pts > bestPoints) {
        bestPoints = pts;
        bestLogin = login;
        bestStart = start;
      }
    }
  }

  if (bestLogin === null) {
    return { key: 'fastest_hour', title: 'Fastest hour', login: null, detail: 'No activity yet' };
  }
  const hour = new Date(bestStart).getUTCHours();
  return {
    key: 'fastest_hour',
    title: 'Fastest hour',
    login: bestLogin,
    detail: `${bestPoints} pts in 60 min · from ${String(hour).padStart(2, '0')}:00 UTC`,
  };
}

/** Biggest climb between the snapshot nearest the day midpoint and the final snapshot. */
function comeback(db: Database.Database, date: string): Superlative {
  const frames = framesForDate(db, date);
  if (frames.length === 0) {
    return { key: 'comeback', title: 'Comeback of the day', login: null, detail: 'No snapshots' };
  }

  const final = frames[frames.length - 1]!;
  const first = frames[0]!;
  const mid = (new Date(first.capturedAt).getTime() + new Date(final.capturedAt).getTime()) / 2;
  let midFrame = first;
  let bestDist = Infinity;
  for (const f of frames) {
    const dist = Math.abs(new Date(f.capturedAt).getTime() - mid);
    if (dist < bestDist) {
      bestDist = dist;
      midFrame = f;
    }
  }

  const midScore = new Map(midFrame.scores.map((s) => [s.login, s.score]));
  let bestLogin: string | null = null;
  let bestClimb = 0;
  for (const s of final.scores) {
    const climb = s.score - (midScore.get(s.login) ?? 0);
    if (climb > bestClimb || (climb === bestClimb && climb > 0 && (bestLogin === null || s.login < bestLogin))) {
      bestClimb = climb;
      bestLogin = s.login;
    }
  }

  if (bestLogin === null || bestClimb <= 0) {
    return { key: 'comeback', title: 'Comeback of the day', login: null, detail: 'No late climb' };
  }
  return {
    key: 'comeback',
    title: 'Comeback of the day',
    login: bestLogin,
    detail: `+${bestClimb} pts in the second half`,
  };
}

/** Author of the latest event of the day. */
function midnightGrinder(db: Database.Database, date: string): Superlative {
  const events = eventsForDate(db, date).sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
  if (events.length === 0) {
    return { key: 'midnight_grinder', title: 'Midnight grinder', login: null, detail: 'No activity yet' };
  }
  const latest = events[0]!;
  const hh = new Date(latest.occurredAt).getUTCHours();
  const mm = new Date(latest.occurredAt).getUTCMinutes();
  return {
    key: 'midnight_grinder',
    title: 'Midnight grinder',
    login: latest.racerLogin,
    detail: `Last commit at ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} UTC`,
  };
}
