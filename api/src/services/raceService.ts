import type Database from 'better-sqlite3';
import type { RaceToday, RaceArchive, RaceListItem, RacerStanding, Racer } from '@racingshape/shared';
import { breakdownByRacer } from '../db/repositories/events.js';
import { summariesForDate, listForDate } from '../db/repositories/reactions.js';
import { framesForDate } from '../db/repositories/snapshots.js';
import { listRacers } from '../db/repositories/racers.js';
import { getMeta } from '../db/repositories/pollMeta.js';
import { buildStandings } from '../scoring/standings.js';
import { raceDateFor } from '../time/raceDate.js';
import { cosmeticsFor } from './cosmeticsService.js';
import { buildRecap } from './recapService.js';

/**
 * Prior-poll scores from the second-to-last snapshot frame, used by buildStandings to
 * mark the top mover (biggest gainer since the previous frame). Undefined when there
 * are fewer than two frames — no topMover until there is a prior to compare against.
 */
function previousScoresFromFrames(db: Database.Database, raceDate: string): Map<string, number> | undefined {
  const frames = framesForDate(db, raceDate);
  if (frames.length < 2) return undefined;
  return new Map(frames[frames.length - 2]!.scores.map((s): [string, number] => [s.login, s.score]));
}

function standingsFor(db: Database.Database, raceDate: string): RacerStanding[] {
  const breakdown = breakdownByRacer(db, raceDate);
  const racers = new Map(
    listRacers(db)
      .filter((r) => breakdown.has(r.login))
      .map((r): [string, Racer] => [r.login, r]),
  );
  const reactions = summariesForDate(db, raceDate);
  const cosmetics = cosmeticsFor(db, raceDate);
  const previousScores = previousScoresFromFrames(db, raceDate);
  return buildStandings(breakdown, racers, { previousScores, reactions, cosmetics });
}

function topScoreOf(standings: RacerStanding[]): number {
  return Math.max(1, ...standings.map((s) => s.score));
}

export function getToday(db: Database.Database, now: Date): RaceToday {
  const raceDate = raceDateFor(now);
  const standings = standingsFor(db, raceDate);
  return {
    raceDate,
    live: true,
    topScore: topScoreOf(standings),
    standings,
    lastPolledAt: getMeta(db, 'last_polled_at') ?? null,
  };
}

export function getArchive(db: Database.Database, date: string): RaceArchive {
  const standings = standingsFor(db, date);
  return {
    raceDate: date,
    live: false,
    topScore: topScoreOf(standings),
    standings,
    frames: framesForDate(db, date),
    reactions: listForDate(db, date),
    recap: buildRecap(db, date),
  };
}

export function listRaces(db: Database.Database): RaceListItem[] {
  const today = raceDateFor(new Date());
  const dates = db
    .prepare(
      `SELECT DISTINCT race_date AS d FROM (
         SELECT race_date FROM race_snapshots
         UNION SELECT race_date FROM events
       ) WHERE race_date <> ? ORDER BY d DESC`,
    )
    .all(today) as { d: string }[];

  return dates.map(({ d }) => {
    const standings = standingsFor(db, d);
    return {
      raceDate: d,
      topScore: topScoreOf(standings),
      winnerLogin: standings.length > 0 ? standings[0]!.login : null,
    };
  });
}
