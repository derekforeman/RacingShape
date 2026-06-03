import { render, screen } from '@testing-library/react';
import { PitWall } from '../components/PitWall';
import type { StatsResponse } from '../lib/types';

const stats: StatsResponse = {
  range: '14d',
  repoUrl: 'https://github.com/S2AI/s2shape',
  chart: [],
  totalTasks: { total: 37, issues: 23, prs: 14, deltaVsPriorWeek: 9 },
  completion: { rate: 0.82, closed: 41, opened: 50 },
  streak: { current: 12, startDate: '2026-05-22', bestThisMonth: 12 },
};

describe('PitWall', () => {
  it('renders the three team stat values', () => {
    render(<PitWall stats={stats} />);
    expect(screen.getByTestId('stat-tasks')).toHaveTextContent('37');
    expect(screen.getByTestId('stat-completion')).toHaveTextContent('82%');
    expect(screen.getByTestId('stat-streak')).toHaveTextContent('12');
  });

  it('tasks value tooltip shows the issues + PRs composition', () => {
    render(<PitWall stats={stats} />);
    const tip = screen.getByTestId('stat-tasks').getAttribute('data-tip') ?? '';
    expect(tip).toContain('23 issues');
    expect(tip).toContain('14 pull requests');
  });

  it('completion gauge tooltip shows n / m', () => {
    render(<PitWall stats={stats} />);
    expect(screen.getByTestId('completion-gauge').getAttribute('data-tip')).toContain('41 / 50');
    expect(screen.getByTestId('completion-fill').style.width).toBe('82%');
  });

  it('streak tooltip names the run start and best this month', () => {
    render(<PitWall stats={stats} />);
    const tip = screen.getByTestId('stat-streak').getAttribute('data-tip') ?? '';
    expect(tip).toContain('2026-05-22');
    expect(tip).toContain('best this month is 12');
  });

  it('shows the signed delta-vs-prior-week sub-line', () => {
    render(<PitWall stats={stats} />);
    expect(screen.getByText(/\+9 vs prior week/)).toBeInTheDocument();
  });
});
