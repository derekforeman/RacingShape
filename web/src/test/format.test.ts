import {
  breakdownBody,
  standingTip,
  gapText,
  completionText,
  streakText,
  chartDayBody,
} from '../lib/format';
import type { RacerStanding, ScoreBreakdown } from '../lib/types';

const bk: ScoreBreakdown = { commit: 10, pr_opened: 2, pr_merged: 3, issue_closed: 0 };

function standing(overrides: Partial<RacerStanding>): RacerStanding {
  return {
    login: 'devon-r',
    displayName: 'devon-r',
    avatarUrl: '',
    score: 44,
    breakdown: bk,
    position: 1,
    gapToLeader: 0,
    isLeader: true,
    topMover: false,
    reactions: { total: 0, byKind: { '🔥': 0, '⚡': 0, '🏎️': 0 } },
    cosmetics: [],
    ...overrides,
  };
}

describe('format helpers', () => {
  it('breakdownBody lists each non-zero type as events × weight = points', () => {
    expect(breakdownBody(bk)).toBe('10 commits ×1 = 10\n2 PRs opened ×5 = 10\n3 PRs merged ×8 = 24');
  });

  it('breakdownBody returns a no-activity line when all zero', () => {
    expect(breakdownBody({ commit: 0, pr_opened: 0, pr_merged: 0, issue_closed: 0 })).toBe(
      'No tracked activity yet today',
    );
  });

  it('gapText returns LDR for the leader and +n otherwise', () => {
    expect(gapText(standing({ isLeader: true, gapToLeader: 0 }))).toBe('LDR');
    expect(gapText(standing({ isLeader: false, gapToLeader: 13, position: 2 }))).toBe('+13');
  });

  it('standingTip combines header, breakdown, and gap line for a leader', () => {
    const out = standingTip(standing({ isLeader: true, score: 44 }));
    expect(out).toContain('devon-r — 44 pts||');
    expect(out).toContain('10 commits ×1 = 10');
    expect(out).toContain('Leading the race');
  });

  it('standingTip shows pts-behind for a non-leader', () => {
    const out = standingTip(standing({ isLeader: false, gapToLeader: 13, score: 31, position: 2 }));
    expect(out).toContain('13 pts behind leader');
  });

  it('completionText renders n / m closed or merged', () => {
    expect(completionText({ rate: 0.82, closed: 41, opened: 50 })).toBe(
      '41 / 50 opened items were closed or merged',
    );
  });

  it('streakText names the run start and best this month', () => {
    expect(streakText({ current: 12, startDate: '2026-05-22', bestThisMonth: 12 })).toBe(
      'Consecutive days with at least one tracked event. Current run started 2026-05-22; best this month is 12.',
    );
  });

  it('streakText handles a null start (no active run)', () => {
    expect(streakText({ current: 0, startDate: null, bestThisMonth: 4 })).toBe(
      'No active streak. Best this month is 4.',
    );
  });

  it('chartDayBody lists exact counts for a day', () => {
    expect(chartDayBody({ raceDate: '2026-06-02', commits: 8, prsOpened: 2, issuesClosed: 1 })).toBe(
      '8 commits\n2 PRs opened\n1 issue closed',
    );
  });
});
