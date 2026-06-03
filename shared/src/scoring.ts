import type { EventType, ScoreBreakdown } from './types.js';

/** Weighted activity points per GitHub event. Tune here only (PRD §4). */
export const SCORE_WEIGHTS: Record<EventType, number> = {
  commit: 1,
  pr_opened: 5,
  pr_merged: 8,
  issue_closed: 3,
};

export function pointsFor(type: EventType): number {
  return SCORE_WEIGHTS[type];
}

/** Total score from a count-per-type breakdown. */
export function scoreFromBreakdown(b: ScoreBreakdown): number {
  return (
    b.commit * SCORE_WEIGHTS.commit +
    b.pr_opened * SCORE_WEIGHTS.pr_opened +
    b.pr_merged * SCORE_WEIGHTS.pr_merged +
    b.issue_closed * SCORE_WEIGHTS.issue_closed
  );
}

export const EMPTY_BREAKDOWN: ScoreBreakdown = {
  commit: 0,
  pr_opened: 0,
  pr_merged: 0,
  issue_closed: 0,
};
