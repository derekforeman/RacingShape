import { describe, it, expect } from 'vitest';
import {
  pointsFor,
  scoreFromBreakdown,
  EMPTY_BREAKDOWN,
  SCORE_WEIGHTS,
} from '../src/index.js';
import type { ScoreBreakdown } from '../src/index.js';

describe('SCORE_WEIGHTS', () => {
  it('uses the canonical weights from PRD §4', () => {
    expect(SCORE_WEIGHTS).toEqual({
      commit: 1,
      pr_opened: 5,
      pr_merged: 8,
      issue_closed: 3,
    });
  });
});

describe('pointsFor', () => {
  it('returns the weight for each event type', () => {
    expect(pointsFor('commit')).toBe(1);
    expect(pointsFor('pr_opened')).toBe(5);
    expect(pointsFor('pr_merged')).toBe(8);
    expect(pointsFor('issue_closed')).toBe(3);
  });
});

describe('EMPTY_BREAKDOWN', () => {
  it('is all zeros', () => {
    expect(EMPTY_BREAKDOWN).toEqual({
      commit: 0,
      pr_opened: 0,
      pr_merged: 0,
      issue_closed: 0,
    });
  });

  it('scores to zero', () => {
    expect(scoreFromBreakdown(EMPTY_BREAKDOWN)).toBe(0);
  });
});

describe('scoreFromBreakdown', () => {
  it('multiplies each count by its weight and sums', () => {
    const b: ScoreBreakdown = {
      commit: 3, // 3
      pr_opened: 2, // 10
      pr_merged: 1, // 8
      issue_closed: 4, // 12
    };
    expect(scoreFromBreakdown(b)).toBe(3 + 10 + 8 + 12);
  });

  it('handles a single commit', () => {
    expect(scoreFromBreakdown({ commit: 1, pr_opened: 0, pr_merged: 0, issue_closed: 0 })).toBe(1);
  });

  it('handles a single merged PR', () => {
    expect(scoreFromBreakdown({ commit: 0, pr_opened: 0, pr_merged: 1, issue_closed: 0 })).toBe(8);
  });
});
