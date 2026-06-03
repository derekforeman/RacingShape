import { SCORE_WEIGHTS } from '@racingshape/shared';
import type { RacerStanding, ScoreBreakdown, CompletionStat, StreakStat, ChartDay } from './types';
import { tip } from './tooltip';

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many;
}

/** Mirrors the mockup's bkText: one line per non-zero type, events × weight = points. */
export function breakdownBody(b: ScoreBreakdown): string {
  const lines: string[] = [];
  if (b.commit)
    lines.push(`${b.commit} ${plural(b.commit, 'commit', 'commits')} ×${SCORE_WEIGHTS.commit} = ${b.commit * SCORE_WEIGHTS.commit}`);
  if (b.pr_opened)
    lines.push(`${b.pr_opened} ${plural(b.pr_opened, 'PR opened', 'PRs opened')} ×${SCORE_WEIGHTS.pr_opened} = ${b.pr_opened * SCORE_WEIGHTS.pr_opened}`);
  if (b.pr_merged)
    lines.push(`${b.pr_merged} ${plural(b.pr_merged, 'PR merged', 'PRs merged')} ×${SCORE_WEIGHTS.pr_merged} = ${b.pr_merged * SCORE_WEIGHTS.pr_merged}`);
  if (b.issue_closed)
    lines.push(`${b.issue_closed} ${plural(b.issue_closed, 'issue closed', 'issues closed')} ×${SCORE_WEIGHTS.issue_closed} = ${b.issue_closed * SCORE_WEIGHTS.issue_closed}`);
  return lines.length ? lines.join('\n') : 'No tracked activity yet today';
}

export function gapText(s: RacerStanding): string {
  return s.isLeader ? 'LDR' : `+${s.gapToLeader}`;
}

/** Full row/pod tooltip: header `login — n pts`, breakdown lines, then a gap line. */
export function standingTip(s: RacerStanding): string {
  const tail = s.isLeader ? '\n\nLeading the race' : `\n\n${s.gapToLeader} pts behind leader`;
  return tip(`${s.login} — ${s.score} pts`, `${breakdownBody(s.breakdown)}${tail}`);
}

export function completionText(c: CompletionStat): string {
  return `${c.closed} / ${c.opened} opened items were closed or merged`;
}

export function streakText(s: StreakStat): string {
  if (s.current === 0 || !s.startDate) {
    return `No active streak. Best this month is ${s.bestThisMonth}.`;
  }
  return `Consecutive days with at least one tracked event. Current run started ${s.startDate}; best this month is ${s.bestThisMonth}.`;
}

export function chartDayBody(d: ChartDay): string {
  return [
    `${d.commits} ${plural(d.commits, 'commit', 'commits')}`,
    `${d.prsOpened} ${plural(d.prsOpened, 'PR opened', 'PRs opened')}`,
    `${d.issuesClosed} ${plural(d.issuesClosed, 'issue closed', 'issues closed')}`,
  ].join('\n');
}
