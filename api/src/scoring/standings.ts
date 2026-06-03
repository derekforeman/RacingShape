import type {
  Cosmetic,
  Racer,
  RacerStanding,
  ReactionSummary,
  ScoreBreakdown,
} from '@racingshape/shared';
import { scoreFromBreakdown } from '@racingshape/shared';

const ZERO_REACTIONS = (): ReactionSummary => ({
  total: 0,
  byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 },
});

export interface BuildStandingsOpts {
  previousScores?: Map<string, number>;
  reactions?: Map<string, ReactionSummary>;
  cosmetics?: Map<string, Cosmetic[]>;
}

/**
 * Pure standings builder. Sorted desc by score; ties broken by login asc and sharing the
 * lower position number. gapToLeader is points behind P1. Exactly one topMover: the racer
 * with the largest strictly-positive gain vs previousScores (a positive nudge only — none
 * if there is no prior data or nobody gained).
 */
export function buildStandings(
  breakdowns: Map<string, ScoreBreakdown>,
  racers: Map<string, Racer>,
  opts: BuildStandingsOpts,
): RacerStanding[] {
  const entries = Array.from(breakdowns.entries()).map(([login, breakdown]) => ({
    login,
    breakdown,
    score: scoreFromBreakdown(breakdown),
  }));

  if (entries.length === 0) return [];

  entries.sort((a, b) => b.score - a.score || a.login.localeCompare(b.login));

  const topScore = entries[0]!.score;

  // Determine the topMover: largest strictly-positive delta vs previousScores.
  let topMoverLogin: string | null = null;
  const prev = opts.previousScores;
  if (prev) {
    let bestDelta = 0;
    for (const e of entries) {
      const before = prev.get(e.login);
      if (before === undefined) continue;
      const delta = e.score - before;
      if (delta > bestDelta) {
        bestDelta = delta;
        topMoverLogin = e.login;
      }
    }
  }

  // Positions: ties share the lower number; next distinct score jumps to its rank index + 1.
  const standings: RacerStanding[] = [];
  let position = 0;
  let lastScore: number | null = null;
  entries.forEach((e, index) => {
    if (lastScore === null || e.score !== lastScore) {
      position = index + 1;
      lastScore = e.score;
    }
    const racer = racers.get(e.login);
    standings.push({
      login: e.login,
      displayName: racer?.displayName ?? e.login,
      avatarUrl: racer?.avatarUrl ?? '',
      score: e.score,
      breakdown: e.breakdown,
      position,
      gapToLeader: topScore - e.score,
      isLeader: e.score === topScore,
      topMover: e.login === topMoverLogin,
      reactions: opts.reactions?.get(e.login) ?? ZERO_REACTIONS(),
      cosmetics: opts.cosmetics?.get(e.login) ?? [],
    });
  });

  return standings;
}
