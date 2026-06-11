import { render, screen, within } from '@testing-library/react';
import { TelemetryChart } from '../components/TelemetryChart';
import type { StatsResponse } from '../lib/types';

const stats: StatsResponse = {
  range: '14d',
  repoUrl: 'https://github.com/S2AI/s2shape',
  chart: [
    { raceDate: '2026-06-01', commits: 5, prsOpened: 1, issuesClosed: 0 },
    { raceDate: '2026-06-02', commits: 10, prsOpened: 2, issuesClosed: 2 },
  ],
  totalTasks: { total: 0, issues: 0, prs: 0, deltaVsPriorWeek: 0 },
  completion: { rate: 0, closed: 0, opened: 0 },
  streak: { current: 0, startDate: null, bestThisMonth: 0 },
  crowd: { peakToday: 0, peaks: [] },
};

describe('TelemetryChart', () => {
  it('renders one column per chart day', () => {
    render(<TelemetryChart stats={stats} />);
    expect(screen.getAllByTestId('chart-col')).toHaveLength(2);
  });

  it('scales the tallest day to 100% height', () => {
    render(<TelemetryChart stats={stats} />);
    const stacks = screen.getAllByTestId('chart-stack');
    expect(stacks[1].style.height).toBe('100%');
    expect(parseFloat(stacks[0].style.height)).toBeCloseTo((6 / 14) * 100, 1);
  });

  it('segments are proportional to the counts', () => {
    render(<TelemetryChart stats={stats} />);
    const stack = screen.getAllByTestId('chart-stack')[1];
    expect(within(stack).getByTestId('seg-commits').style.flexGrow).toBe('10');
    expect(within(stack).getByTestId('seg-prs').style.flexGrow).toBe('2');
    expect(within(stack).getByTestId('seg-issues').style.flexGrow).toBe('2');
  });

  it('each bar exposes a tooltip with exact counts and date', () => {
    render(<TelemetryChart stats={stats} />);
    const stack = screen.getAllByTestId('chart-stack')[1];
    expect(stack.getAttribute('data-tip')).toContain('2026-06-02||');
    expect(stack.getAttribute('data-tip')).toContain('10 commits');
    expect(stack.getAttribute('data-tip')).toContain('2 PRs opened');
    expect(stack.getAttribute('data-tip')).toContain('2 issues closed');
  });

  it('the GITHUB badge and series links target the repo', () => {
    render(<TelemetryChart stats={stats} />);
    expect(screen.getByTestId('github-badge')).toHaveAttribute('href', 'https://github.com/S2AI/s2shape');
    expect(screen.getByTestId('link-commits')).toHaveAttribute('href', 'https://github.com/S2AI/s2shape/commits');
    expect(screen.getByTestId('link-prs')).toHaveAttribute('href', 'https://github.com/S2AI/s2shape/pulls');
    expect(screen.getByTestId('link-issues')).toHaveAttribute('href', 'https://github.com/S2AI/s2shape/issues?q=is%3Aissue+is%3Aclosed');
  });
});
