import { describe, it, expect } from 'vitest';
import { buildStandings } from '../../src/scoring/standings.js';
import type { Racer, ScoreBreakdown, ReactionSummary, Cosmetic } from '@racingshape/shared';

const racer = (login: string): Racer => ({
  login,
  displayName: login.toUpperCase(),
  avatarUrl: `https://a/${login}.png`,
  firstSeen: '2026-06-01T00:00:00.000Z',
});

const bd = (over: Partial<ScoreBreakdown>): ScoreBreakdown => ({
  commit: 0,
  pr_opened: 0,
  pr_merged: 0,
  issue_closed: 0,
  ...over,
});

function racersMap(...logins: string[]): Map<string, Racer> {
  return new Map(logins.map((l) => [l, racer(l)]));
}

describe('buildStandings', () => {
  it('returns an empty array for empty input', () => {
    expect(buildStandings(new Map(), new Map(), {})).toEqual([]);
  });

  it('orders descending by score and assigns 1-based positions', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([
      ['amy', bd({ commit: 3 })], // 3
      ['ben', bd({ pr_merged: 1 })], // 8
      ['cat', bd({ pr_opened: 1 })], // 5
    ]);
    const standings = buildStandings(breakdowns, racersMap('amy', 'ben', 'cat'), {});
    expect(standings.map((s) => [s.login, s.score, s.position])).toEqual([
      ['ben', 8, 1],
      ['cat', 5, 2],
      ['amy', 3, 3],
    ]);
  });

  it('computes gapToLeader from the top score; leader has gap 0 and isLeader true', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([
      ['ben', bd({ pr_merged: 1 })], // 8
      ['amy', bd({ commit: 3 })], // 3
    ]);
    const standings = buildStandings(breakdowns, racersMap('amy', 'ben'), {});
    const ben = standings.find((s) => s.login === 'ben')!;
    const amy = standings.find((s) => s.login === 'amy')!;
    expect(ben.isLeader).toBe(true);
    expect(ben.gapToLeader).toBe(0);
    expect(amy.isLeader).toBe(false);
    expect(amy.gapToLeader).toBe(5);
  });

  it('ties share the lower position and break by login asc for ordering', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([
      ['zoe', bd({ commit: 5 })], // 5
      ['amy', bd({ commit: 5 })], // 5
      ['ben', bd({ commit: 1 })], // 1
    ]);
    const standings = buildStandings(breakdowns, racersMap('amy', 'ben', 'zoe'), {});
    // amy and zoe tie at 5 -> both position 1, ordered amy before zoe; ben gets position 3
    expect(standings.map((s) => [s.login, s.position])).toEqual([
      ['amy', 1],
      ['zoe', 1],
      ['ben', 3],
    ]);
    expect(standings.find((s) => s.login === 'amy')!.isLeader).toBe(true);
    expect(standings.find((s) => s.login === 'zoe')!.isLeader).toBe(true);
  });

  it('selects exactly one topMover: the largest positive delta vs previousScores', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([
      ['amy', bd({ commit: 10 })], // now 10
      ['ben', bd({ commit: 4 })], // now 4
    ]);
    const previousScores = new Map<string, number>([
      ['amy', 8], // +2
      ['ben', 0], // +4  <- biggest gain
    ]);
    const standings = buildStandings(breakdowns, racersMap('amy', 'ben'), { previousScores });
    expect(standings.find((s) => s.login === 'ben')!.topMover).toBe(true);
    expect(standings.find((s) => s.login === 'amy')!.topMover).toBe(false);
  });

  it('no topMover when there is no prior data', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([['amy', bd({ commit: 5 })]]);
    const standings = buildStandings(breakdowns, racersMap('amy'), {});
    expect(standings.every((s) => s.topMover === false)).toBe(true);
  });

  it('no topMover when no one gained (all deltas <= 0)', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([['amy', bd({ commit: 5 })]]);
    const previousScores = new Map<string, number>([['amy', 5]]); // delta 0
    const standings = buildStandings(breakdowns, racersMap('amy'), { previousScores });
    expect(standings.every((s) => s.topMover === false)).toBe(true);
  });

  it('attaches reactions and cosmetics from opts, defaulting to zero/empty', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([
      ['amy', bd({ commit: 2 })],
      ['ben', bd({ commit: 1 })],
    ]);
    const reactions = new Map<string, ReactionSummary>([
      ['amy', { total: 3, byKind: { '🔥': 2, '⚡': 1, '🏎️': 0 } }],
    ]);
    const cosmetics = new Map<string, Cosmetic[]>([['ben', ['gold_rims']]]);
    const standings = buildStandings(breakdowns, racersMap('amy', 'ben'), {
      reactions,
      cosmetics,
    });
    const amy = standings.find((s) => s.login === 'amy')!;
    const ben = standings.find((s) => s.login === 'ben')!;
    expect(amy.reactions).toEqual({ total: 3, byKind: { '🔥': 2, '⚡': 1, '🏎️': 0 } });
    expect(amy.cosmetics).toEqual([]);
    expect(ben.reactions).toEqual({ total: 0, byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 } });
    expect(ben.cosmetics).toEqual(['gold_rims']);
  });

  it('carries displayName, avatarUrl, and breakdown through from the racer/breakdown maps', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([['amy', bd({ commit: 2, pr_merged: 1 })]]);
    const standings = buildStandings(breakdowns, racersMap('amy'), {});
    expect(standings[0]).toMatchObject({
      login: 'amy',
      displayName: 'AMY',
      avatarUrl: 'https://a/amy.png',
      score: 10,
      breakdown: { commit: 2, pr_opened: 0, pr_merged: 1, issue_closed: 0 },
    });
  });

  it('falls back to login for display fields when the racer is unknown', () => {
    const breakdowns = new Map<string, ScoreBreakdown>([['ghost', bd({ commit: 1 })]]);
    const standings = buildStandings(breakdowns, new Map(), {});
    expect(standings[0]).toMatchObject({
      login: 'ghost',
      displayName: 'ghost',
      avatarUrl: '',
    });
  });
});
